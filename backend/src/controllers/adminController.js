const User = require("../models/User");
const Rating = require("../models/Rating");
const LateSubmissionRequest = require("../models/LateSubmissionRequest");
const { WORKER_AREAS } = require("../constants/workerAreas");

async function getAdminUsers(req, res) {
  try {
    const users = await User.find()
      .select("-password")
      .sort({ name: 1 })
      .collation({ locale: "en", strength: 2 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function updateUserRole(req, res) {
  try {
    const { role } = req.body;
    if (!["worker", "supervisor", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (role === "worker" && !user.username) {
      return res.status(400).json({ message: "This user has no username and cannot become a worker. Add a username first." });
    }
    if (role !== "worker" && !user.email) {
      return res.status(400).json({ message: "This user has no email and cannot become a supervisor or admin. Add an email first." });
    }

    user.role = role;
    if (role !== "worker") {
      user.area = null;
    }
    await user.save();

    const updated = user.toObject();
    delete updated.password;
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function updateWorkerArea(req, res) {
  try {
    const { area } = req.body;
    if (area !== null && !WORKER_AREAS.includes(area)) {
      return res.status(400).json({ message: "Invalid worker area" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.role !== "worker") {
      return res.status(400).json({ message: "Areas can only be assigned to workers" });
    }

    user.area = area;
    await user.save();

    const updated = user.toObject();
    delete updated.password;
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function deleteUser(req, res) {
  try {
    await Rating.deleteMany({
      $or: [{ ratedUser: req.params.id }, { ratedBy: req.params.id }]
    });

    // NEW: LateSubmissionRequest is its own collection now — clean it up
    // too, or deleting a user leaves orphaned permission requests pointing
    // at a user that no longer exists.
    await LateSubmissionRequest.deleteMany({
      $or: [{ ratedUser: req.params.id }, { ratedBy: req.params.id }]
    });

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function changePassword(req, res) {
  try {
    const { password } = req.body;
    const updated = await User.findByIdAndUpdate(req.params.id, { password }, { returnDocument: 'after' }).select("-password");
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function getAdminDashboard(req, res) {
  try {
    const totalUsers = await User.countDocuments();
    const workers = await User.countDocuments({ role: "worker" });
    const supervisors = await User.countDocuments({ role: "supervisor" });
    const admins = await User.countDocuments({ role: "admin" });

    const avgRating = await User.aggregate([
      { $match: { role: "worker" } },
      { $group: { _id: null, avg: { $avg: "$averageRating" } } }
    ]);

    res.json({
      totalUsers,
      workers,
      supervisors,
      admins,
      avgRating: avgRating[0]?.avg || 0
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function getPendingRatingEditRequests(req, res) {
  try {
    const requests = await Rating.find({
      workerEditRequestStatus: "pending"
    })
      .populate("ratedBy", "name email role")
      .populate("ratedUser", "name email role")
      .sort({ workerEditRequestAt: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// REMOVED: getPendingLateSubmissionRequests and the garbled review function
// used to live here, querying Rating.workerLateSubmissionStatus. That flow
// now lives in ratingController.js (getPendingLateSubmissionRequests /
// reviewLateSubmissionRequest), backed by the standalone
// LateSubmissionRequest collection, and adminRoutes.js already points there.
// Keeping the old versions here would have left dead code that still reads
// a Rating field nothing sets anymore, plus two more bugs: no admin-role
// check before approving/rejecting, and a typo'd field name
// (rating.wor9yMnTm4NSzvG9rrwjM2ec8xZgh1cafXH8) that silently failed to
// persist the reviewing admin's id.

async function reviewRatingEditRequest(req, res) {
  try {
    const { ratingId } = req.params;
    const { adminId, action } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "Action must be approve or reject." });
    }

    const admin = await User.findById(adminId).select("role");
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ message: "Only admins can review edit requests." });
    }

    const rating = await Rating.findById(ratingId);
    if (!rating) return res.status(404).json({ message: "Rating not found." });
    if (rating.workerEditRequestStatus !== "pending") {
      return res.status(400).json({ message: "This request is not pending." });
    }

    rating.workerEditRequestStatus = action === "approve" ? "approved" : "rejected";
    rating.workerEditRequestReviewedAt = new Date();
    rating.workerEditRequestReviewedBy = adminId;
    await rating.save();

    res.json({ message: `Request ${action}d successfully.`, rating });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function getPendingWorkerApprovals(req, res) {
  try {
    const pendingWorkers = await User.find({
      role: "worker",
      isApproved: false
    })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json(pendingWorkers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function approveWorker(req, res) {
  try {
    const { workerId } = req.params;
    const worker = await User.findById(workerId);

    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    if (worker.role !== "worker") {
      return res.status(400).json({ message: "Only workers can be approved" });
    }

    worker.isApproved = true;
    await worker.save();

    const workerObj = worker.toObject();
    delete workerObj.password;
    res.json({ message: "Worker approved successfully", worker: workerObj });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function rejectWorker(req, res) {
  try {
    const { workerId } = req.params;
    const worker = await User.findById(workerId);

    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    if (worker.role !== "worker") {
      return res.status(400).json({ message: "Only workers can be rejected" });
    }

    await User.findByIdAndDelete(workerId);
    res.json({ message: "Worker rejected and deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  getAdminUsers,
  updateUserRole,
  updateWorkerArea,
  deleteUser,
  changePassword,
  getAdminDashboard,
  getPendingRatingEditRequests,
  reviewRatingEditRequest,
  getPendingWorkerApprovals,
  approveWorker,
  rejectWorker
};