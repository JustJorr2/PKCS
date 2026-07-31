const User = require("../models/User");
const Rating = require("../models/Rating");
const LateSubmissionRequest = require("../models/LateSubmissionRequest");
const { KPI_FIELDS } = require("../constants/kpiFields");
const { getMonthKey, getPreviousMonthKey, getAllowedMonthsForRole, getLastThreeMonths } = require("../utils/dateKeys");

async function submitRating(req, res) {
  try {
    const rater = await User.findById(req.body.ratedBy).select("role");
    if (!rater) return res.status(404).json({ message: "Rater not found" });

    const currentMonth = getMonthKey();
    const previousMonth = getPreviousMonthKey();
    const targetMonth = req.body.dateKey || (rater.role === "worker" ? previousMonth : currentMonth);

    // FIX: the old code computed allowedMonths and then had a bare, always-
    // executing block below it (not actually gated by an `if`), so every
    // worker submission was rejected with 403 regardless of month. This now
    // actually checks targetMonth against the allowed set.
    if (rater.role === "worker") {
      const allowedMonths = getAllowedMonthsForRole(rater.role);
      if (!allowedMonths.has(targetMonth)) {
        return res.status(403).json({
          message: "Workers can only submit or edit ratings for last month after the month has ended."
        });
      }
    }

    const existingRating = await Rating.findOne({
      ratedBy: req.body.ratedBy,
      ratedUser: req.body.ratedUser,
      dateKey: targetMonth
    });

    let newRating;

    if (existingRating) {
      if (rater.role === "worker" && existingRating.workerEditRequestStatus !== "approved") {
        return res.status(403).json({
          message: "This rating is locked. Please request admin approval before editing."
        });
      }

      KPI_FIELDS.forEach((f) => {
        existingRating[f] = req.body[f];
      });
      existingRating.comment = req.body.comment;
      if (rater.role === "worker") {
        existingRating.workerEditRequestStatus = "none";
        existingRating.workerEditRequestReason = "";
        existingRating.workerEditRequestAt = null;
      }
      newRating = await existingRating.save();
    } else {
      const rating = new Rating({
        ratedBy: req.body.ratedBy,
        ratedUser: req.body.ratedUser,
        ...KPI_FIELDS.reduce((acc, f) => {
          acc[f] = req.body[f];
          return acc;
        }, {}),
        comment: req.body.comment,
        dateKey: targetMonth
      });
      newRating = await rating.save();
    }

    const allRatings = await Rating.find({ ratedUser: req.body.ratedUser });
    let totalScore = 0;
    allRatings.forEach((r) => {
      let sum = 0;
      KPI_FIELDS.forEach((f) => {
        sum += r[f];
      });
      totalScore += sum / KPI_FIELDS.length;
    });
    const avgScore = (totalScore / allRatings.length).toFixed(2);

    await User.findByIdAndUpdate(req.body.ratedUser, {
      averageRating: avgScore,
      totalRatings: allRatings.length
    });

    res.status(201).json(newRating);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

async function requestWorkerRatingEdit(req, res) {
  try {
    const { ratingId } = req.params;
    const { workerId, reason } = req.body;

    const worker = await User.findById(workerId).select("role");
    if (!worker || worker.role !== "worker") {
      return res.status(403).json({ message: "Only workers can request rating edits." });
    }

    const rating = await Rating.findById(ratingId);
    if (!rating) return res.status(404).json({ message: "Rating not found." });
    if (String(rating.ratedBy) !== String(workerId)) {
      return res.status(403).json({ message: "You can only request edit for your own rating." });
    }

    // Check if rating is within last 3 months
    const allowedMonths = getLastThreeMonths();
    if (!allowedMonths.has(rating.dateKey)) {
      return res.status(403).json({ 
        message: "You can only request edits for ratings from the last 3 months." 
      });
    }

    rating.workerEditRequestStatus = "pending";
    rating.workerEditRequestReason = (reason || "").trim();
    rating.workerEditRequestAt = new Date();
    rating.workerEditRequestReviewedAt = null;
    rating.workerEditRequestReviewedBy = null;
    await rating.save();

    res.json({ message: "Edit request sent to admin.", rating });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// Operates on LateSubmissionRequest, not Rating — this is the fix. The old
// versions of this function required Rating.findById(ratingId), but no
// Rating exists yet when a supervisor is requesting permission to submit
// late. There were also two `function requestLateSubmission` declarations
// in this file; the second silently overwrote the first (duplicate function
// names in the same scope), and that second one was a copy-paste of
// requestWorkerRatingEdit that wrote into the wrong fields
// (workerEditRequestReason/At instead of the late-submission equivalents).
async function requestLateSubmission(req, res) {
  try {
    const { workerId, ratedUser, month, reason } = req.body;
    // "workerId" is the id of the worker requesting permission to rate a
    // colleague late — this is peer review (WorkerRatings.js / "Rate
    // Colleagues"), not a supervisor-to-worker flow. ratedUser is the
    // colleague who would be rated once permission is approved.

    if (!workerId || !ratedUser || !month) {
      return res.status(400).json({ message: "workerId, ratedUser, and month are required." });
    }

    const rater = await User.findById(workerId).select("role");
    if (!rater || rater.role !== "worker") {
      return res.status(403).json({ message: "Only workers can request late submission permission." });
    }

    const existing = await LateSubmissionRequest.findOne({
      ratedBy: workerId,
      ratedUser,
      dateKey: month
    });

    let request;
    if (existing) {
      if (existing.status === "approved") {
        return res.status(400).json({ message: "This permission was already approved." });
      }
      existing.status = "pending";
      existing.reason = (reason || "").trim();
      existing.reviewedAt = null;
      existing.reviewedBy = null;
      request = await existing.save();
    } else {
      request = await LateSubmissionRequest.create({
        ratedBy: workerId,
        ratedUser,
        dateKey: month,
        reason: (reason || "").trim(),
        status: "pending"
      });
    }

    res.json({ message: "Late submission request sent to admin.", request });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

async function getLateSubmissionRequestsForSupervisor(req, res) {
  try {
    const { supervisorId } = req.params;
    const { month } = req.query;

    const filter = { ratedBy: supervisorId };
    if (month) filter.dateKey = month;

    const requests = await LateSubmissionRequest.find(filter);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function getPendingLateSubmissionRequests(req, res) {
  try {
    const requests = await LateSubmissionRequest.find({ status: "pending" })
      .populate("ratedBy", "name role")
      .populate("ratedUser", "name role")
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function r9yMnTm4NSzvG9rrwjM2ec8xZgh1cafXH8(req, res) {
  try {
    const { requestId } = req.params;
    const { adminId, action } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "action must be 'approve' or 'reject'." });
    }

    const request = await LateSubmissionRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found." });

    request.status = action === "approve" ? "approved" : "rejected";
    request.reviewedAt = new Date();
    request.reviewedBy = adminId || null;
    await request.save();

    res.json({ message: `Request ${request.status}.`, request });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

async function getRatingsForWorker(req, res) {
  try {
    const { date, month } = req.query;
    const filter = { ratedUser: req.params.userId };

    if (date) filter.dateKey = date;
    else if (month) filter.dateKey = month;

    const ratings = await Rating.find(filter)
      .populate("ratedBy", "name role")
      .sort({ createdAt: -1 });

    res.json(ratings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function getRatingHistory(req, res) {
  try {
    const { supervisorId } = req.query;
    const currentMonth = getMonthKey();

    const filter = {
      ratedUser: req.params.workerId,
      dateKey: { $ne: currentMonth }
    };

    if (supervisorId) filter.ratedBy = supervisorId;

    const ratings = await Rating.find(filter)
      .populate("ratedBy", "name role")
      .sort({ dateKey: -1 });

    const grouped = {};
    ratings.forEach((r) => {
      if (!grouped[r.dateKey]) grouped[r.dateKey] = [];
      grouped[r.dateKey].push(r);
    });

    const result = Object.entries(grouped).map(([date, entries]) => ({ date, entries }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  submitRating,
  getRatingsForWorker,
  getRatingHistory,
  requestWorkerRatingEdit,
  requestLateSubmission,
  getLateSubmissionRequestsForSupervisor,
  getPendingLateSubmissionRequests,
  r9yMnTm4NSzvG9rrwjM2ec8xZgh1cafXH8
};