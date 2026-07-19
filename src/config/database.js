const mongoose = require("mongoose");
const env = require("./env");
const { seedProductMappings } = require("../utils/seeder");
const { loadProductMappings } = require("../utils/item-key");

async function connectToDatabase() {
  mongoose.set("strictQuery", true);
  // Log which URI is being used (mask credentials) to help debugging
  try {
    const uri = env.mongoUri || "mongodb://127.0.0.1:27017/finifi";
    const rawEnvUri = process.env.MONGODB_URI || '<none>';
    const maskedRaw = String(rawEnvUri).replace(/:\/\/(?:[^:@]+)(?::[^@]+)?@/, '://$REDACTED@');
    const masked = String(uri).replace(/:\/\/(?:[^:@]+)(?::[^@]+)?@/, '://$REDACTED@');
    console.log(`process.env.MONGODB_URI: ${maskedRaw}`);
    console.log(`env.mongoUri: ${masked}`);
  } catch (e) {
    // ignore logging errors
  }

  await mongoose.connect(env.mongoUri);
  await seedProductMappings();
  await loadProductMappings();
}

async function disconnectFromDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = {
  connectToDatabase,
  disconnectFromDatabase,
};

