const mongoose = require("mongoose");

async function connectDB() {
  console.log("Connecting to Mongo...");

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 30000
  });

  console.log("Mongo Connected");
}

module.exports = { connectDB };
