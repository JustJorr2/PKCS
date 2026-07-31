const express = require("express");
const {
  getAdminUsers,
  updateUserRole,
  deleteUser,
  changePassword,
  getAdminDashboard,
  getPendingRatingEditRequests,
  reviewRatingEditRequest,
  getPendingWorkerApprovals,
  approveWorker,
  rejectWorker
} = require("../controllers/adminController");

const {
  getPendingLateSubmissionRequests,
  r9yMnTm4NSzvG9rrwjM2ec8xZgh1cafXH8
} = require("../controllers/ratingController");

const router = express.Router();

router.get("/admin/users", getAdminUsers);
router.put("/admin/users/:id/role", updateUserRole);
router.delete("/admin/users/:id", deleteUser);
router.put("/admin/users/:id/password", changePassword);
router.get("/admin/dashboard", getAdminDashboard);
router.get("/admin/rating-edit-requests", getPendingRatingEditRequests);
router.put("/admin/rating-edit-requests/:ratingId", reviewRatingEditRequest);
router.get("/admin/worker-approvals", getPendingWorkerApprovals);
router.put("/admin/worker-approvals/:workerId/approve", approveWorker);
router.delete("/admin/worker-approvals/:workerId/reject", rejectWorker);
router.get("/admin/late-submission-requests", getPendingLateSubmissionRequests);
router.put("/admin/late-submission-requests/:requestId", r9yMnTm4NSzvG9rrwjM2ec8xZgh1cafXH8);

module.exports = router;