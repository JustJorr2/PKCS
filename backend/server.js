require("dotenv").config();

const app = require("./src/app");
const { connectDB } = require("./src/config/db");

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Server running on ${PORT}`);

  try {
    await connectDB();
    console.log("Mongo connected");
  } catch (err) {
    console.error("Mongo failed:", err.message);
  }
});