import { useState, useEffect, useCallback, useMemo } from "react";
import { supervisorService } from "../../services/api";
import { getRatingColor } from "../../utils/helpers";
import { useNavigate } from "react-router-dom";
import RatingForm from "../../components/RatingForm";
import "../../styles/Supervisor/SupervisorPages.css";
import "../../styles/User/WorkerDashboard.css";
import { useLanguage } from "../../context/LanguageContext";
import { config } from "../../config/config";
import { Users, CircleCheck, Clock, TrendingUp  } from "lucide-react";

function getPreviousMonthKey() {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric"
  });
}

function formatTime(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit", minute: "2-digit"
  });
}

function formatMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey;
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long"
  });
}

function formatRating(value, language) {
  if (value === null || value === undefined || isNaN(value)) return "-";
  const formatted = Number(value).toFixed(2);
  return language === "id" ? formatted.replace(".", ",") : formatted;
}

const RATING_COLOR_LEGEND = [
  { color: "#95a5a6", key: "noRatings", fallback: "No ratings yet" },
  { color: "#27ae60", key: "excellent", fallback: "Excellent (≥ 3.51)" },
  { color: "#2f80ed", key: "good", fallback: "Good (2.76 – 3.50)" },
  { color: "#f39c12", key: "average", fallback: "Average (2.00 – 2.75)" },
  { color: "#e74c3c", key: "needsImprovement", fallback: "Needs Improvement (< 2.00)" }
];

function SupervisorRatings({ worker: supervisor }) {
  const { t, language } = useLanguage();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingWorker, setRatingWorker] = useState(null);
  const [editingRating, setEditingRating] = useState(null);
  const [ratedWorkerIds, setRatedWorkerIds] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [selectedMonth, setSelectedMonth] = useState(getPreviousMonthKey());
  const [filterMonth, setFilterMonth] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const navigate = useNavigate();
  const defaultMonth = getPreviousMonthKey();

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await supervisorService.getDashboard(selectedMonth, supervisor?._id);
      setWorkers(response.data || []);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, supervisor?._id]);

  const fetchSupervisorRatings = useCallback(async () => {
    if (!supervisor?._id) {
      setRatedWorkerIds(new Set());
      return;
    }
    try {
      const response = await supervisorService.getSupervisorRatings(supervisor._id, selectedMonth);
      const ratedIds = new Set((response.data || []).map((r) => r.ratedUser));
      setRatedWorkerIds(ratedIds);
    } catch (err) {
      console.error("Error fetching supervisor ratings:", err);
    }
  }, [supervisor?._id, selectedMonth]);

  useEffect(() => {
    fetchDashboardData();
    fetchSupervisorRatings();
  }, [fetchDashboardData, fetchSupervisorRatings]);


  const handleApplyFilter = () => {
    const month = filterMonth || defaultMonth;
    setSelectedMonth(month);
    setActiveFilter(filterMonth ? `Month: ${filterMonth}` : "");
    setShowPeriodPicker(false);
  };

  const handleResetFilter = () => {
    setFilterMonth("");
    setActiveFilter("");
    setSelectedMonth(defaultMonth);
    setShowPeriodPicker(false);
  };

  const handleRatingSuccess = () => {
    setRatingWorker(null);
    setEditingRating(null);
    fetchDashboardData();
    fetchSupervisorRatings();
  };

  const isAlreadyRated = useCallback((workerId) => ratedWorkerIds.has(workerId), [ratedWorkerIds]);

  const handleRateWorker = (worker) => {
    setEditingRating(null);
    setRatingWorker(worker);
  };

  const handleEditWorker = async (worker) => {
    try {
      const response = await supervisorService.getExistingRating(supervisor._id, worker._id, selectedMonth);
      setEditingRating(response.data || null);
      setRatingWorker(worker);
    } catch (err) {
      if (err.response?.status === 404) {
        setEditingRating(null);
        setRatingWorker(worker);
      } else {
        alert(err.response?.data?.message || t("supervisorRatings.edit"));
      }
    }
  };

  const { filteredWorkers, ratedCount, unratedCount } = useMemo(() => {
    const ratedWorkers = workers.filter((w) => isAlreadyRated(w._id)).length;
    const unratedWorkers = workers.length - ratedWorkers;
    const normalizedSearch = searchTerm.trim().toLowerCase();
    

    const list = workers
      .filter((worker) => {
        const matchesSearch =
          (worker.name ?? "").toLowerCase().includes(normalizedSearch) ||
          (worker.email ?? "").toLowerCase().includes(normalizedSearch);
        const matchesFilter =
          filterStatus === "all" ||
          (filterStatus === "rated" && isAlreadyRated(worker._id)) ||
          (filterStatus === "unrated" && !isAlreadyRated(worker._id));
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        if (sortBy === "rating") return (b.cumulativeAverageRating || 0) - (a.cumulativeAverageRating || 0);
        if (sortBy === "recent") {
          const aDate = a.latestRating?.createdAt ? new Date(a.latestRating.createdAt).getTime() : 0;
          const bDate = b.latestRating?.createdAt ? new Date(b.latestRating.createdAt).getTime() : 0;
          return bDate - aDate;
        }
        return a.name.localeCompare(b.name);
      });

    return { filteredWorkers: list, ratedCount: ratedWorkers, unratedCount: unratedWorkers };
  }, [workers, searchTerm, filterStatus, sortBy, isAlreadyRated]);

  const myAverageRatingThisMonth = useMemo(() => {
    const rated = workers.filter((w) => typeof w.monthAverageRating === "number");
      if (rated.length === 0) return null;
      const sum = rated.reduce((acc, w) => acc + w.monthAverageRating, 0);
      return sum / rated.length;
  }, [workers]);

  return (
    <div className="page-content supervisor-details">
      {ratingWorker && (
        <RatingForm
          worker={ratingWorker}
          userId={supervisor?._id}
          onSuccess={handleRatingSuccess}
          onCancel={() => {
            setRatingWorker(null);
            setEditingRating(null);
          }}
          isEditing={Boolean(editingRating)}
          initialValues={editingRating}
          selectedMonth={selectedMonth}
        />
      )}

      {/* HEADER + PERIOD FILTER (moved to top right) */}
      <div className="page-header supervisor-ratings-header">
        <div>
          <h1>{t("supervisorRatings.title")}</h1>
          <p>{t("supervisorRatings.subtitle")}</p>
        </div>

        <div className="period-filter-wrap">
          <div
            className="period-filter-card"
            onClick={() => setShowPeriodPicker((prev) => !prev)}
          >
            <span className="period-icon">📅</span>
            <div className="period-info">
              <span className="period-label">{t("supervisorRatings.periodActive")}</span>
              <span className="period-value">{formatMonthLabel(selectedMonth)}</span>
            </div>
            <span className="period-toggle">{showPeriodPicker ? "▲" : "▼"}</span>
          </div>

          {showPeriodPicker && (
            <div className="period-picker-dropdown">
              <div className="wf-filter-group">
                <label>{t("supervisorRatings.byMonth")}</label>
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                />
              </div>
              <button className="wf-btn-apply" onClick={handleApplyFilter}>
                {t("supervisorRatings.apply")}
              </button>
              {activeFilter && (
                <button className="wf-btn-reset" onClick={handleResetFilter}>
                  x {activeFilter}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* STATS WIDGETS */}
      <div className="details-stats-row">

        <div className="quick-stat-pill">
          <span className="pill-icon">
            <Users size={20} />
          </span>

          <div className="pill-text">
            <span className="label">
              {t("supervisorRatings.visibleWorkers")}:
            </span>

            <span className="value">
              {filteredWorkers.length}
            </span>
          </div>
        </div>

        <div className="quick-stat-pill">
          <span className="pill-icon">
            <CircleCheck size={20} />
          </span>

          <div className="pill-text">
            <span className="label">
              {t("supervisorRatings.ratedInMonth")}:
            </span>

            <span className="value">
              {ratedCount}
            </span>
          </div>
        </div>

        <div className="quick-stat-pill">
          <span className="pill-icon">
            <Clock size={20} />
          </span>

          <div className="pill-text">
            <span className="label">
              {t("supervisorRatings.notYetRated")}:
            </span>

            <span className="value">
              {unratedCount}
            </span>
          </div>
        </div>

        <div className="quick-stat-pill">
          <span className="pill-icon">
            <TrendingUp size={20} />
          </span>

          <div className="pill-text">
            <span className="label">
              {t("supervisorRatings.myAverageRating") || "My Average Rating This Month"}:
            </span>

            <span className="value" style={{ color: myAverageRatingThisMonth !== null ? getRatingColor(myAverageRatingThisMonth) : undefined }}>
              {myAverageRatingThisMonth !== null ? `${formatRating(myAverageRatingThisMonth, language)} ★` : "-"}
            </span>
          </div>
        </div>
        
      </div>

      <div className="details-toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder={t("supervisorRatings.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="sort-group">
          <label htmlFor="details-sort">{t("supervisorRatings.sort")}</label>
          <select
            id="details-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="name">{t("supervisorRatings.sortName")}</option>
            <option value="rating">{t("supervisorRatings.sortRating")}</option>
            <option value="recent">{t("supervisorRatings.sortRecent")}</option>
          </select>
        </div>

        <div className="filter-buttons">
          <button
            className={`filter-btn ${filterStatus === "all" ? "active" : ""}`}
            onClick={() => setFilterStatus("all")}
          >
            {t("supervisorRatings.all")} ({workers.length})
          </button>
          <button
            className={`filter-btn ${filterStatus === "rated" ? "active" : ""}`}
            onClick={() => setFilterStatus("rated")}
          >
            {t("supervisorRatings.rated")} ({ratedCount})
          </button>
          <button
            className={`filter-btn ${filterStatus === "unrated" ? "active" : ""}`}
            onClick={() => setFilterStatus("unrated")}
          >
            {t("supervisorRatings.unrated")} ({unratedCount})
          </button>
        </div>
      </div>

      {/* RATING COLOR LEGEND - replaces the old per-row status badge */}
      <div
        className="rating-color-legend"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "16px",
          margin: "14px 0",
          padding: "10px 14px",
          background: "#f9fafb",
          borderRadius: "10px",
          fontSize: "13px",
          color: "#4b5563"
        }}
      >
        <span style={{ fontWeight: 700, color: "#374151" }}>
          {t("supervisorRatings.legendTitle") || "Rating colors:"}
        </span>
        {RATING_COLOR_LEGEND.map((item) => (
          <span key={item.key} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: item.color,
                display: "inline-block"
              }}
            />
            {t(`ratingStatus.${item.key}`) || item.fallback}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="loading">{t("supervisorRatings.loadingWorkers")}</div>
      ) : filteredWorkers.length === 0 ? (
        <div className="no-data">
          {searchTerm ? t("supervisorRatings.noWorkersSearch") : t("supervisorRatings.noWorkersDisplay")}
        </div>
      ) : (
        <div
          className="table-responsive"
          style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}
        >
          <table
            className="workers-table supervisor-ratings-table"
            style={{ minWidth: "900px" }}
          >
            <thead>
              <tr>
                <th>#</th>
                <th>{t("supervisorRatings.name")}</th>
                <th>{t("supervisorRatings.avgRating")}</th>
                <th>{t("supervisorRatings.sessions")}</th>
                <th>{t("supervisorRatings.latestRating")}</th>
                <th style={{ textAlign: "center" }}>
                  {t("supervisorRatings.myRatingThisMonth") || "My Rating This Period"}
                </th>
                <th style={{ textAlign: "center" }}>{t("supervisorRatings.action")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.map((worker, index) => (
                <tr key={worker._id} className={isAlreadyRated(worker._id) ? "rated-row" : ""}>
                  <td data-label="#">{index + 1}</td>
                  <td data-label={t("supervisorRatings.name")}>
                    <div
                      className="worker-name-cell clickable"
                      onClick={() => navigate(`/worker/${worker._id}`)}
                    >
                      {worker.profilePicture ? (
                        <img
                          src={`${config.API_BASE_URL}/${worker.profilePicture}`}
                          alt={worker.name}
                          className="worker-badge worker-badge-image"
                        />
                      ) : (
                        <div className="worker-badge">
                          {worker.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {worker.name}
                    </div>
                  </td>
                  <td data-label={t("supervisorRatings.avgRating")}>
                    {typeof worker.cumulativeAverageRating === "number" ? (
                      <span
                        className="rating-badge"
                        style={{ backgroundColor: getRatingColor(worker.cumulativeAverageRating) }}
                      >
                        {formatRating(worker.cumulativeAverageRating, language)}
                      </span>
                    ) : (
                      <span className="rating-badge rating-badge--none">-</span>
                    )}
                  </td>
                  <td className="center" data-label={t("supervisorRatings.sessions")}>
                    {worker.cumulativeRatingsCount ?? 0}
                  </td>
                  <td className="latest-rating-cell" data-label={t("supervisorRatings.latestRating")}>
                    {worker.latestRating ? (
                      <>
                        {formatDate(worker.latestRating.createdAt)}{" "}
                        <span className="latest-rating-time">{formatTime(worker.latestRating.createdAt)}</span>
                      </>
                    ) : (
                      <span className="text-muted">{t("supervisorRatings.noRatingsYet")}</span>
                    )}
                  </td>
                  <td className="center" data-label={t("supervisorRatings.myRatingThisMonth") || "My Rating This Period"}>
                    {typeof worker.monthAverageRating === "number" ? (
                      <span
                        className="rating-badge"
                        style={{ backgroundColor: getRatingColor(worker.monthAverageRating) }}
                      >
                        {formatRating(worker.monthAverageRating, language)}
                      </span>
                    ) : (
                      <span className="rating-badge rating-badge--none">-</span>
                    )}
                  </td>
                  <td className="action-cell" data-label={t("supervisorRatings.action")}>
                    <div className="action-buttons">
                      {isAlreadyRated(worker._id) ? (
                        <>
                          <button
                            className="btn btn-outline"
                            onClick={() => navigate(`/worker/${worker._id}`)}
                            title={t("supervisorRatings.viewDetail")}
                          >
                            {t("supervisorRatings.detail")}
                          </button>
                          <button
                            className="btn btn-edit"
                            onClick={() => handleEditWorker(worker)}
                            title={`Edit this worker's rating for ${selectedMonth}`}
                          >
                            {t("supervisorRatings.edit")}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn-outline"
                            onClick={() => navigate(`/worker/${worker._id}`)}
                            title={t("supervisorRatings.viewDetail")}
                          >
                            {t("supervisorRatings.detail")}
                          </button>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleRateWorker(worker)}
                            title={`Rate this worker for ${selectedMonth}`}
                          >
                            {t("supervisorRatings.rate")}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SupervisorRatings;