const mongoose = require("mongoose");
const ratingSchema = new mongoose.Schema({
  ratedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  ratedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  workAreaCompliance: { type: Number, min: 0, max: 4, required: true },
  taskCompletion: { type: Number, min: 0, max: 4, required: true },
  cleanliness: { type: Number, min: 0, max: 4, required: true },
  wasteManagement: { type: Number, min: 0, max: 4, required: true },
  organization: { type: Number, min: 0, max: 4, required: true },
  uniformCompliance: { type: Number, min: 0, max: 4, required: true },
  independence: { type: Number, min: 0, max: 4, required: true },
  initiative: { type: Number, min: 0, max: 4, required: true },
  teamworkSupport: { type: Number, min: 0, max: 4, required: true },
  punctuality: { type: Number, min: 0, max: 4, required: true },
  attendance: { type: Number, min: 0, max: 4, required: true },
  leaveOnTime: { type: Number, min: 0, max: 4, required: true },
  comment: String,
  workerEditRequestStatus: {
    type: String,
    enum: ["none", "pending", "approved", "rejected"],
    default: "none"
  },
  workerEditRequestReason: { type: String, default: "" },
  workerEditRequestAt: { type: Date, default: null },
  workerEditRequestReviewedAt: { type: Date, default: null },
  workerEditRequestReviewedBy: {
    workerLateSubmissionStatus: {
    type: String,
    enum: ["none", "pending", "approved", "rejected"],
    default: "none"
    },
    workerLateSubmissionReason: {
        type: String,
        default: ""
    },
    workerLateSubmissionAt: {
        type: Date,
        default: null
    },
    workerLateSubmissionReviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    workerLateSubmissionReviewedAt: {
        type: Date,
        default: null
    },
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  createdAt: { type: Date, default: Date.now },
  dateKey: { type: String, required: true }
});
ratingSchema.index({ ratedBy: 1, ratedUser: 1, dateKey: 1 }, { unique: true });
module.exports = mongoose.model("Rating", ratingSchema);