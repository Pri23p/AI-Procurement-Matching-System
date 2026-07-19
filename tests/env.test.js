const test = require("node:test");
const assert = require("node:assert/strict");
const env = require("../src/config/env");

test("assertRequiredEnv throws when required env vars are missing", () => {
  const originalMongoUri = process.env.MONGODB_URI;
  const originalGroqApiKey = process.env.GROQ_API_KEY;

  delete process.env.MONGODB_URI;
  delete process.env.GROQ_API_KEY;

  try {
    assert.throws(() => env.assertRequiredEnv(), /Missing required environment variables/);
  } finally {
    if (originalMongoUri !== undefined) {
      process.env.MONGODB_URI = originalMongoUri;
    }
    if (originalGroqApiKey !== undefined) {
      process.env.GROQ_API_KEY = originalGroqApiKey;
    }
  }
});