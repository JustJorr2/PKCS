const mongoose = require("mongoose");
require("dotenv").config();

const KPI_FIELDS = [
  "workAreaCompliance",
  "taskCompletion",
  "cleanliness",
  "wasteManagement",
  "organization",
  "uniformCompliance",
  "independence",
  "initiative",
  "teamworkSupport",
  "punctuality",
  "attendance"
];

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
  averageRating: Number,
  totalRatings: Number
});

const ratingSchema = new mongoose.Schema({
  ratedBy: mongoose.Schema.Types.ObjectId,
  ratedUser: mongoose.Schema.Types.ObjectId,
  workAreaCompliance: Number,
  taskCompletion: Number,
  cleanliness: Number,
  wasteManagement: Number,
  organization: Number,
  uniformCompliance: Number,
  independence: Number,
  initiative: Number,
  teamworkSupport: Number,
  punctuality: Number,
  attendance: Number
});

const User = mongoose.model("User", userSchema);
const Rating = mongoose.model("Rating", ratingSchema);

async function rebuild() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    const workers = await User.find({ role: "worker" }).select("_id");

    for (const worker of workers) {
      const ratings = await Rating.find({ ratedUser: worker._id }).lean();

      if (!ratings.length) {
        await User.findByIdAndUpdate(worker._id, {
          averageRating: 0,
          totalRatings: 0
        });
        continue;
      }

      let totalScore = 0;

      for (const r of ratings) {
        let sum = 0;
        for (const field of KPI_FIELDS) {
          sum += Number(r[field] || 0);
        }
        totalScore += sum / KPI_FIELDS.length;
      }

      const avgScore = Number((totalScore / ratings.length).toFixed(2));

      await User.findByIdAndUpdate(worker._id, {
        averageRating: avgScore,
        totalRatings: ratings.length
      });
    }

    console.log(`Rebuilt rating stats for ${workers.length} workers`);
  } catch (err) {
    console.error("Rebuild failed:", err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

rebuild();
