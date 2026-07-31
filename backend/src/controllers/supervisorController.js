const User = require("../models/User");
const Rating = require("../models/Rating");
const { KPI_FIELDS } = require("../constants/kpiFields");
const { getMonthKey, getPreviousMonthKey, getAllowedMonthsForRole } = require("../utils/dateKeys");

async function getDashboard(req, res) {
  try {
    const selectedMonth = req.query.month;

    let viewerRole = null;
    if (req.query.viewerId) {
      const viewer = await User.findById(req.query.viewerId).select("role").lean();
      viewerRole = viewer ? viewer.role : null;
    }
    const canSeeRatings = viewerRole === "supervisor" || viewerRole === "admin";
    const isWorkerViewer = viewerRole === "worker";

    const workers = await User.find({ role: "worker" })
      .select("_id name email role profilePicture averageRating totalRatings createdAt")
      .lean()
      .sort({ averageRating: -1 });

    if (isWorkerViewer) {
      // Workers may see each peer's latest comment, but never scores/averages.
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
      // Unknown / unauthenticated viewer — safest default, no rating data at all.
      const safeWorkers = workers.map(({ averageRating, totalRatings, ...rest }) => rest);
      return res.json(safeWorkers);
    }

    const workersWithLatestRating = await Promise.all(
      workers.map(async (worker) => {
        const latestRatingFilter = selectedMonth
          ? { ratedUser: worker._id, dateKey: selectedMonth }
          : { ratedUser: worker._id };

        const latestRating = await Rating.findOne(latestRatingFilter)
          .populate("ratedBy", "name role")
          .lean()
          .sort({ createdAt: -1 });

        let monthAverageRating = null;
        if (selectedMonth) {
          const monthRatings = await Rating.find({
            ratedUser: worker._id,
            dateKey: selectedMonth
          }).lean();

          if (monthRatings.length > 0) {
            const ratingAverages = monthRatings.map((r) => {
              const total = KPI_FIELDS.reduce((sum, field) => sum + (Number(r[field]) || 0), 0);
              return total / KPI_FIELDS.length;
            });
            monthAverageRating = ratingAverages.reduce((sum, val) => sum + val, 0) / ratingAverages.length;
          }
        }

        return { ...worker, latestRating, monthAverageRating };
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
    
    // Workers can only view current/previous month; supervisors can view any month
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
    
    // Workers can only view current/previous month; supervisors can view any month
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
