require("dotenv").config();
const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
const cors = require("cors");

const app = express();
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: "ap-south-1",
});

const s3 = new AWS.S3();

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const file = req.file;
    const category = req.body.category;

    const key = `${category}/${Date.now()}-${file.originalname}`;

    const params = {
      Bucket: "vetinwild",
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const uploadResult = await s3.upload(params).promise();

    res.json({
      message: "Upload success",
      url: uploadResult.Location,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.get("/generate-upload-url", async (req, res) => {
  try {
    const { category, fileName, fileType } = req.query;

    const key = `${category}/${Date.now()}-${fileName}`;

    const params = {
      Bucket: "vetinwild",
      Key: key,
      Expires: 60, // URL valid for 60 seconds
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

app.listen(5000, () => console.log("Server running on port 5000"));
