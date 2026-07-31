require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./src/models/User");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected. Syncing indexes...");
  await User.syncIndexes();
  console.log("Done. Current indexes:");
  console.log(await User.collection.getIndexes());
  await mongoose.disconnect();
  console.log("Disconnected.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});