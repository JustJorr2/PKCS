const express = require("express");
const {
  submitRating,
  getRatingsForWorker,
  getRatingHistory,
  requestWorkerRatingEdit,
  requestLateSubmission
} = require("../controllers/ratingController");

const router = express.Router();

router.post("/ratings", submitRating);
router.post("/ratings/:ratingId/request-edit", requestWorkerRatingEdit);
router.get("/ratings/worker/:userId", getRatingsForWorker);
router.get("/ratings/worker/:workerId/history", getRatingHistory);
router.post("/ratings/request-late-submission", requestLateSubmission);

module.exports = router;