const mongoose = require("mongoose");

// Deliberately separate from Rating. A permission request can exist, be
// approved, and be reviewed entirely before any Rating document is created —
// coupling this to Rating (as the old code did) makes that impossible.
const lateSubmissionRequestSchema = new mongoose.Schema(
  {
    ratedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // worker requesting permission (peer review)
    ratedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // colleague who would be rated
    dateKey: { type: String, required: true }, // e.g. "2026-05"
    reason: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

// One live request per supervisor/worker/month combo. Re-requesting after a
// rejection updates this doc rather than piling up duplicates.
lateSubmissionRequestSchema.index(
  { ratedBy: 1, ratedUser: 1, dateKey: 1 },
  { unique: true }
);

module.exports = mongoose.model("LateSubmissionRequest", lateSubmissionRequestSchema);