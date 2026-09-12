require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("./src/config/db");
const User = require("./src/models/User");

async function migrateWorkerAreas() {
  await connectDB();

  const result = await User.updateMany(
    { area: { $exists: false } },
    { $set: { area: null } }
  );

  console.log(`Initialized area on ${result.modifiedCount} user(s). No areas were assigned.`);
  await mongoose.disconnect();
}

migrateWorkerAreas().catch(async (err) => {
  console.error("Worker area migration failed:", err);
  await mongoose.disconnect();
  process.exitCode = 1;
});