const express = require("express");
const { getDashboard, getSupervisorRatings, getExistingRating } = require("../controllers/supervisorController");
const { getLateSubmissionRequestsForSupervisor } = require("../controllers/ratingController");

const router = express.Router();

router.get("/supervisor/dashboard", getDashboard);
router.get("/supervisor/ratings/:supervisorId", getSupervisorRatings);
router.get("/rating/:supervisorId/:workerId", getExistingRating);

// NEW: backs supervisorService.getLateSubmissionRequests on the frontend.
router.get("/supervisor/late-submission-requests/:supervisorId", getLateSubmissionRequestsForSupervisor);

module.exports = router;