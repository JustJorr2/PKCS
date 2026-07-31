const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    required: function () {
      return this.role !== "worker";
    },
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  username: {
    type: String,
    required: function () {
      return this.role === "worker";
    },
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  password: { type: String, required: true },
  role: { type: String, enum: ["worker", "supervisor", "admin"], default: "worker" },
  isApproved: { type: Boolean, default: function() { return this.role !== "worker"; } },
  profilePicture: { type: String, default: null },
  averageRating: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);