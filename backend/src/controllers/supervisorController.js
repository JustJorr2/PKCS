const User = require("../models/User");
const Rating = require("../models/Rating");
const { KPI_FIELDS } = require("../constants/kpiFields");
const { getMonthKey, getPreviousMonthKey, getAllowedMonthsForRole } = require("../utils/dateKeys");

// Keep this in sync with BELOW_THRESHOLD in SupervisorHome.jsx.
const LOW_RATING_THRESHOLD = 2.0;

async function getDashboard(req, res) {
  try {
    const selectedMonth = req.query.month;
    const viewerId = req.query.viewerId;

    let viewerRole = null;
    if (viewerId) {
      const viewer = await User.findById(viewerId).select("role").lean();
      viewerRole = viewer ? viewer.role : null;
    }
    const canSeeRatings = viewerRole === "supervisor" || viewerRole === "admin";
    const isWorkerViewer = viewerRole === "worker";
    // Only used to scope "latest rating" / "cumulative average" queries so a
    // supervisor only ever sees their OWN submissions, not other
    // supervisors' ratings for the same worker.
    const scopeToOwnRatings = viewerRole === "supervisor";

    const workers = await User.find({ role: "worker" })
      .select("_id name email role profilePicture averageRating totalRatings createdAt")
      .lean()
      .sort({ averageRating: -1 });

    if (isWorkerViewer) {
      const workersWithComment = await Promise.all(
        workers.map(async (worker) => {
          const latestRatingFilter = selectedMonth
            ? { ratedUser: worker._id, dateKey: selectedMonth }
            : { ratedUser: worker._id };

          const latest = await Rating.findOne(latestRatingFilter)
            .select("comment createdAt dateKey")
            .lean()
            .sort({ createdAt: -1 });

          const { averageRating, totalRatings, ...rest } = worker;
          return {
            ...rest,
            latestComment: latest
              ? { comment: latest.comment, createdAt: latest.createdAt, dateKey: latest.dateKey }
              : null
          };
        })
      );
      return res.json(workersWithComment);
    }

    if (!canSeeRatings) {
      const safeWorkers = workers.map(({ averageRating, totalRatings, ...rest }) => rest);
      return res.json(safeWorkers);
    }

    const workersWithLatestRating = await Promise.all(
      workers.map(async (worker) => {
        // Fetch every rating for this worker once (scoped to this
        // supervisor's own submissions when the viewer is a supervisor),
        // then derive the month-specific average, the cumulative
        // (all-time) average, AND the low-rating history from the same
        // result set instead of separate queries.
        const baseFilter = {
          ratedUser: worker._id,
          ...(scopeToOwnRatings ? { ratedBy: viewerId } : {})
        };

        const allRatingsForWorker = await Rating.find(baseFilter)
          .populate("ratedBy", "name role")
          .lean()
          .sort({ createdAt: -1 });

        const toKpiAverage = (r) => {
          const total = KPI_FIELDS.reduce((sum, field) => sum + (Number(r[field]) || 0), 0);
          return total / KPI_FIELDS.length;
        };

        const latestRating = selectedMonth
          ? allRatingsForWorker.find((r) => r.dateKey === selectedMonth) || null
          : allRatingsForWorker[0] || null;

        let monthAverageRating = null;
        if (selectedMonth) {
          const monthRatings = allRatingsForWorker.filter((r) => r.dateKey === selectedMonth);
          if (monthRatings.length > 0) {
            const monthAverages = monthRatings.map(toKpiAverage);
            monthAverageRating = monthAverages.reduce((sum, val) => sum + val, 0) / monthAverages.length;
          }
        }

        // Cumulative average across ALL months this supervisor has rated
        // this worker (e.g. Jan–Jun 2026 combined), used for the
        // "Rata-Rata Kumulatif" / "Status Kumulatif" columns.
        let cumulativeAverageRating = null;
        if (allRatingsForWorker.length > 0) {
          const cumulativeAverages = allRatingsForWorker.map(toKpiAverage);
          cumulativeAverageRating =
            cumulativeAverages.reduce((sum, val) => sum + val, 0) / cumulativeAverages.length;
        }

        // NEW: every individual month where this worker's rating from
        // this supervisor fell below the threshold, kept even after the
        // cumulative average recovers, so "Workers Below 2.0" can reflect
        // history rather than just the current average.
        const lowRatingHistory = allRatingsForWorker
          .map((r) => ({
            dateKey: r.dateKey,
            average: toKpiAverage(r),
            createdAt: r.createdAt
          }))
          .filter((r) => r.average < LOW_RATING_THRESHOLD)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return {
          ...worker,
          latestRating,
          monthAverageRating,
          cumulativeAverageRating,
          cumulativeRatingsCount: allRatingsForWorker.length,
          lowRatingHistory
        };
      })
    );

    res.json(workersWithLatestRating);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function getSupervisorRatings(req, res) {
  try {
    const rater = await User.findById(req.params.supervisorId).select("role");
    if (!rater) return res.status(404).json({ message: "User not found" });

    const currentMonth = getMonthKey();
    const previousMonth = getPreviousMonthKey();
    const defaultMonth = rater.role === "worker" ? previousMonth : currentMonth;
    const requestedMonth = req.query.month || defaultMonth;

    let month = requestedMonth;
    if (rater.role === "worker") {
      const allowedMonths = getAllowedMonthsForRole(rater.role);
      month = allowedMonths.has(requestedMonth) ? requestedMonth : defaultMonth;
    }

    const ratings = await Rating.find({
      ratedBy: req.params.supervisorId,
      dateKey: month
    });

    res.json(ratings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function getExistingRating(req, res) {
  try {
    const rater = await User.findById(req.params.supervisorId).select("role");
    if (!rater) return res.status(404).json({ message: "User not found" });

    const currentMonth = getMonthKey();
    const previousMonth = getPreviousMonthKey();
    const defaultMonth = rater.role === "worker" ? previousMonth : currentMonth;
    const requestedMonth = req.query.month || defaultMonth;

    let month = requestedMonth;
    if (rater.role === "worker") {
      const allowedMonths = getAllowedMonthsForRole(rater.role);
      month = allowedMonths.has(requestedMonth) ? requestedMonth : defaultMonth;
    }

    const rating = await Rating.findOne({
      ratedBy: req.params.supervisorId,
      ratedUser: req.params.workerId,
      dateKey: month
    });

    if (!rating) return res.status(404).json({ message: `No rating found for ${month}` });
    res.json(rating);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  getDashboard,
  getSupervisorRatings,
  getExistingRating
};