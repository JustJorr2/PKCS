const User = require("../models/User");
const Rating = require("../models/Rating");
const { KPI_FIELDS } = require("../constants/kpiFields");
const { getMonthKey, getPreviousMonthKey, getAllowedMonthsForRole } = require("../utils/dateKeys");

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

    const ratingView = req.query.ratingView || (viewerRole === "supervisor" ? "own" : "all");

    const canSeeRatings = viewerRole === "supervisor" || viewerRole === "admin";
    const isWorkerViewer = viewerRole === "worker";

    const workers = await User.find({ role: "worker" })
      .select("_id name email role area profilePicture averageRating totalRatings createdAt")
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

    const ownViewIsEmptyForViewer = ratingView === "own" && viewerRole !== "supervisor";

    const workersWithLatestRating = await Promise.all(
      workers.map(async (worker) => {
        if (ownViewIsEmptyForViewer) {
          return {
            ...worker,
            latestRating: null,
            monthAverageRating: null,
            monthRatingsCount: 0,
            monthRaterIds: [],
            cumulativeAverageRating: null,
            cumulativeRatingsCount: 0,
            cumulativeRaterIds: [],
            lowRatingHistory: []
          };
        }

        const baseFilter = {
          ratedUser: worker._id,
          ...(ratingView === "own" ? { ratedBy: viewerId } : {})
        };

        const fetchedRatings = await Rating.find(baseFilter)
          .populate("ratedBy", "name role")
          .lean()
          .sort({ createdAt: -1 });

        const allRatingsForWorker =
          ratingView === "supervisor"
            ? fetchedRatings.filter((r) => r.ratedBy && r.ratedBy.role === "supervisor")
            : fetchedRatings;

        const toKpiAverage = (r) => {
          const total = KPI_FIELDS.reduce((sum, field) => sum + (Number(r[field]) || 0), 0);
          return total / KPI_FIELDS.length;
        };

        const uniqueRaterIds = (ratings) =>
          [...new Set(
            ratings
              .map((r) => r.ratedBy && r.ratedBy._id && r.ratedBy._id.toString())
              .filter(Boolean)
          )];

        const latestRating = selectedMonth
          ? allRatingsForWorker.find((r) => r.dateKey === selectedMonth) || null
          : allRatingsForWorker[0] || null;

        let monthAverageRating = null;
        let monthRatingsCount = 0;
        let monthRaterIds = [];

        if (selectedMonth) {
          const monthRatings = allRatingsForWorker.filter((r) => r.dateKey === selectedMonth);
          monthRatingsCount = monthRatings.length;
          monthRaterIds = uniqueRaterIds(monthRatings);

          if (monthRatings.length > 0) {
            const monthAverages = monthRatings.map(toKpiAverage);
            monthAverageRating = monthAverages.reduce((sum, val) => sum + val, 0) / monthAverages.length;
          }
        }

        let cumulativeAverageRating = null;
        if (allRatingsForWorker.length > 0) {
          const cumulativeAverages = allRatingsForWorker.map(toKpiAverage);
          cumulativeAverageRating =
            cumulativeAverages.reduce((sum, val) => sum + val, 0) / cumulativeAverages.length;
        }

        const cumulativeRatingsCount = allRatingsForWorker.length;
        const cumulativeRaterIds = uniqueRaterIds(allRatingsForWorker);

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
          monthRatingsCount,
          monthRaterIds,
          cumulativeAverageRating,
          cumulativeRatingsCount,
          cumulativeRaterIds,
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

    const filter = { ratedBy: req.params.supervisorId };

    if (req.query.month) {
      const currentMonth = getMonthKey();
      const previousMonth = getPreviousMonthKey();
      const defaultMonth = rater.role === "worker" ? previousMonth : currentMonth;

      let month = req.query.month;
      if (rater.role === "worker") {
        const allowedMonths = getAllowedMonthsForRole(rater.role);
        month = allowedMonths.has(month) ? month : defaultMonth;
      }

      filter.dateKey = month;
    }

    const ratings = await Rating.find(filter);
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