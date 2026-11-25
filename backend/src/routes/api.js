"use strict";

const express = require("express");
const multer = require("multer");
const path = require("path");
const os = require("os");
const {
  s3Service,
  sdkErrorToPayload,
  isNotImplemented,
} = require("../services/s3");

const router = express.Router();

// Memory storage for small files (skeleton).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

function sendAwsError(res, err) {
  const payload = sdkErrorToPayload(err);
  const status = isNotImplemented(err) ? 501 : payload.statusCode || 500;
  res.status(status).json({
    error: payload.name,
    message: payload.message,
    notImplemented: isNotImplemented(err),
  });
}

// GET /api/s3/buckets
router.get("/buckets", async (req, res) => {
  try {
    const buckets = await s3Service.listBuckets();
    res.json({ buckets });
  } catch (err) {
    sendAwsError(res, err);
  }
});

// POST /api/s3/buckets (create)
router.post("/buckets", express.json(), async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({
      error: "ValidationError",
      message: "Bucket name is required",
    });
  }
  try {
    const result = await s3Service.createBucket(name);
    res.status(201).json(result);
  } catch (err) {
    sendAwsError(res, err);
  }
});

// DELETE /api/s3/buckets/:name
router.delete("/buckets/:name", async (req, res) => {
  try {
    const result = await s3Service.deleteBucket(req.params.name);
    res.json(result);
  } catch (err) {
    sendAwsError(res, err);
  }
});

// GET /api/s3/buckets/:name/objects?prefix=
router.get("/buckets/:name/objects", async (req, res) => {
  try {
    const result = await s3Service.listObjects(
      req.params.name,
      req.query.prefix || ""
    );
    res.json(result);
  } catch (err) {
    sendAwsError(res, err);
  }
});

// POST /api/s3/buckets/:name/objects (upload object, multipart)
router.post(
  "/buckets/:name/objects",
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: "ValidationError",
        message: "No file uploaded",
      });
    }
    const key = req.body.key || req.file.originalname;
    // memoryStorage keeps the file in req.file.buffer
    const fs = require("fs");
    const tmpPath = path.join(
      os.tmpdir(),
      `console-upload-${Date.now()}-${req.file.originalname}`
    );
    fs.writeFileSync(tmpPath, req.file.buffer);
    try {
      const result = await s3Service.uploadObject(
        req.params.name,
        key,
        tmpPath,
        req.file.mimetype
      );
      try {
        fs.unlinkSync(tmpPath);
      } catch {}
      res.status(201).json(result);
    } catch (err) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {}
      sendAwsError(res, err);
    }
  }
);

// DELETE /api/s3/buckets/:name/objects/*  (key is in req.params[0])
router.delete("/buckets/:name/objects/*", async (req, res) => {
  const key = req.params[0];
  try {
    const result = await s3Service.deleteObject(req.params.name, key);
    res.json(result);
  } catch (err) {
    sendAwsError(res, err);
  }
});

// GET /api/s3/buckets/:name/objects/*  (download object)
router.get("/buckets/:name/objects/*", async (req, res) => {
  const key = req.params[0];
  try {
    const output = await s3Service.downloadObject(req.params.name, key);
    res.set("Content-Type", output.ContentType || "application/octet-stream");
    res.set(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(key)}"`
    );
    output.Body.pipe(res);
  } catch (err) {
    sendAwsError(res, err);
  }
});

// GET /api/s3/buckets/:name/versioning
router.get("/buckets/:name/versioning", async (req, res) => {
  try {
    const result = await s3Service.getVersioning(req.params.name);
    res.json(result);
  } catch (err) {
    sendAwsError(res, err);
  }
});

// PUT /api/s3/buckets/:name/versioning  (body: { enabled: boolean })
router.put(
  "/buckets/:name/versioning",
  express.json(),
  async (req, res) => {
    const { enabled } = req.body || {};
    if (typeof enabled !== "boolean") {
      return res.status(400).json({
        error: "ValidationError",
        message: "enabled (boolean) is required",
      });
    }
    try {
      const result = await s3Service.putVersioning(req.params.name, enabled);
      res.json(result);
    } catch (err) {
      sendAwsError(res, err);
    }
  }
);

module.exports = router;
