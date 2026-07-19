const path = require("path");
const dotenv = require("dotenv");
const fs = require("fs");

dotenv.config();
// Read .env file explicitly so we can prefer its values in non-production
try {
  const explicitEnvPath = path.resolve(__dirname, "../..", ".env");
  if (fs.existsSync(explicitEnvPath)) {
    const content = fs.readFileSync(explicitEnvPath, "utf8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const idx = trimmed.indexOf("=");
      const key = trimmed.substring(0, idx).trim();
      let val = trimmed.substring(idx + 1).trim();
      if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      // Make .env authoritative at startup by writing into process.env (helpful for dev)
      try {
        process.env[key] = val;
      } catch (e) {
        // ignore
      }
    }
  }
} catch (e) {
  // ignore
}

const rootDir = path.resolve(__dirname, "../..");

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const env = {
  rootDir,
  nodeEnv: process.env.NODE_ENV || "development",
  port: numberFromEnv(process.env.PORT, 4000),
  // MongoDB URI (process.env may have been populated from .env above)
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/finifi",
  groqApiKey: process.env.GROQ_API_KEY || "",
  groqModel: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  maxFileSizeMb: numberFromEnv(process.env.MAX_FILE_SIZE_MB, 10),
  uploadDir: path.resolve(
    rootDir,
    process.env.UPLOAD_DIR || path.join(".", "uploads"),
  ),
};

function assertRequiredEnv() {
  const missing = [];

  if (!process.env.MONGODB_URI) {
    missing.push("MONGODB_URI");
  }

  if (!process.env.GROQ_API_KEY) {
    missing.push("GROQ_API_KEY");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

module.exports = env;
module.exports.assertRequiredEnv = assertRequiredEnv;

