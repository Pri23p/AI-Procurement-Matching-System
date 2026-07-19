// Ensure project .env is applied as authoritative at startup (helpful for local dev)
try {
  const fs = require("fs");
  const path = require("path");
  const envPath = path.resolve(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const idx = t.indexOf("=");
      const key = t.substring(0, idx).trim();
      let val = t.substring(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
} catch (e) {
  // ignore
}

const app = require("./app");
const env = require("./config/env");
const { connectToDatabase } = require("./config/database");
const { startWorker } = require("./services/queue.service");

async function start() {
  if (typeof env.assertRequiredEnv === "function") {
    env.assertRequiredEnv();
  }

  await connectToDatabase();
  await startWorker();
  app.listen(env.port, () => {
    console.log(`Server listening on port ${env.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});

