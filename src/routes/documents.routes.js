const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const env = require("../config/env");
const asyncHandler = require("../middleware/async-handler");
const { uploadDocument, getDocument } = require("../controllers/document.controller");
const { AppError } = require("../utils/errors");

const router = express.Router();

fs.mkdirSync(env.uploadDir, { recursive: true });

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, env.uploadDir);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "") || ".bin";
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: env.maxFileSizeMb * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new AppError("Only PDF, PNG, and JPEG files are supported.", 400));
      return;
    }

    cb(null, true);
  },
});

router.post("/upload", upload.single("file"), asyncHandler(uploadDocument));
router.get("/:id", asyncHandler(getDocument));

module.exports = router;

