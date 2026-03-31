require("dotenv").config();
const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
const cors = require("cors");

const app = express();

// ✅ Middlewares
app.use(cors());
app.use(express.json());

// ✅ Multer setup (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// ✅ AWS config
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: "eu-north-1",
});

const s3 = new AWS.S3();

// =======================================
// 🚀 UPLOAD ROUTE (FIXED)
// =======================================
app.post("/upload", upload.array("images"), async (req, res) => {
  try {
    const { category } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    if (!category) {
      return res.status(400).json({ error: "Category required" });
    }

    console.log("Uploading to S3...");

    const uploadPromises = req.files.map((file) => {
      const key = `${category}/${Date.now()}-${file.originalname}`;

      return s3
        .upload({
          Bucket: "vetinwild",
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
        .promise();
    });

    const result = await Promise.all(uploadPromises);

    console.log("S3 Upload Success:", result);

    res.json({
      message: "Upload successful",
      files: result,
    });
  } catch (err) {
    console.error("S3 ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

// =======================================
// 🔗 GENERATE SIGNED URL (optional)
// =======================================
app.get("/generate-upload-url", async (req, res) => {
  try {
    const { category, fileName, fileType } = req.query;

    if (!category || !fileName || !fileType) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const key = `${category}/${Date.now()}-${fileName}`;

    const params = {
      Bucket: "vetinwild",
      Key: key,
      Expires: 60,
      ContentType: fileType,
    };

    const url = await s3.getSignedUrlPromise("putObject", params);

    res.json({
      uploadUrl: url,
      key: key,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate URL" });
  }
});

// =======================================
// 📂 GET CATEGORIES
// =======================================
app.get("/categories", async (req, res) => {
  try {
    const data = await s3.listObjectsV2({ Bucket: "vetinwild" }).promise();

    const categories = new Set();

    data.Contents.forEach((item) => {
      if (item.Key.includes("/")) {
        const category = item.Key.split("/")[0];
        categories.add(category);
      }
    });

    res.json([...categories]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// =======================================
// 🖼️ GET ALL IMAGES
// =======================================
app.get("/images", async (req, res) => {
  try {
    const data = await s3.listObjectsV2({ Bucket: "vetinwild" }).promise();

    const images = data.Contents.map((item) => ({
      url: `https://vetinwild.s3.eu-north-1.amazonaws.com/${item.Key}`,
      category: item.Key.split("/")[0],
      key: item.Key,
    }));

    res.json(images);
  } catch (err) {
    console.error("FETCH IMAGES ERROR:", err);
    res.status(500).json({ error: "Failed to fetch images" });
  }
});
// =======================================
// 🏁 SERVER START
// =======================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
