import { useState, useEffect, useCallback, useMemo } from "react";
import { supervisorService } from "../../services/api";
import { getRatingColor, getRatingStatus } from "../../utils/helpers";
import { useNavigate } from "react-router-dom";
import RatingForm from "../../components/RatingForm";
import "../../styles/Supervisor/SupervisorPages.css";
import "../../styles/User/WorkerDashboard.css";
import { useLanguage } from "../../context/LanguageContext";
import { config } from "../../config/config";

const KPI_FIELDS = [
  { key: "workAreaCompliance", label: "Work Area Compliance", short: "WA" },
  { key: "taskCompletion", label: "Task Completion", short: "TC" },
  { key: "cleanliness", label: "Cleanliness", short: "CL" },
  { key: "wasteManagement", label: "Waste Management", short: "WM" },
  { key: "organization", label: "Organization", short: "OR" },
  { key: "uniformCompliance", label: "Uniform Compliance", short: "UC" },
  { key: "independence", label: "Independence", short: "IN" },
  { key: "initiative", label: "Initiative", short: "IV" },
  { key: "teamworkSupport", label: "Teamwork Support", short: "TS" },
  { key: "punctuality", label: "Punctuality", short: "PU" },
  { key: "attendance", label: "Attendance", short: "AT" },
  { key: "leaveOnTime", label: "Leave Work On Time", short: "LT" }
];

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

function formatMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey;
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long"
  });
}

function SupervisorRatings({ worker: supervisor }) {
  const { t } = useLanguage();
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
  };

  const handleResetFilter = () => {
    setFilterMonth("");
    setActiveFilter("");
    setSelectedMonth(defaultMonth);
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
      // If no rating exists for this month, open as a new rating instead
      if (err.response?.status === 404) {
        setEditingRating(null);
        setRatingWorker(worker);
      } else {
        alert(err.response?.data?.message || t("supervisorRatings.edit"));
      }
    }
  };

  const ratedThisMonth = useCallback((worker) => {
    if (!worker.latestRating) return false;
    const ratingMonth = worker.latestRating.dateKey ||
      new Date(worker.latestRating.createdAt).toISOString().slice(0, 7);
    return ratingMonth === selectedMonth;
  }, [selectedMonth]);

  const { filteredWorkers, ratedCount, unratedCount } = useMemo(() => {
    const ratedWorkers = workers.filter((w) => isAlreadyRated(w._id)).length;
    const unratedWorkers = workers.length - ratedWorkers;
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const list = workers
      .filter((worker) => {
        const matchesSearch =
          worker.name.toLowerCase().includes(normalizedSearch) ||
          worker.email.toLowerCase().includes(normalizedSearch);
        const matchesFilter =
          filterStatus === "all" ||
          (filterStatus === "rated" && isAlreadyRated(worker._id)) ||
          (filterStatus === "unrated" && !isAlreadyRated(worker._id));
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        if (sortBy === "rating") return (b.averageRating || 0) - (a.averageRating || 0);
        if (sortBy === "recent") {
          const aDate = a.latestRating?.createdAt ? new Date(a.latestRating.createdAt).getTime() : 0;
          const bDate = b.latestRating?.createdAt ? new Date(b.latestRating.createdAt).getTime() : 0;
          return bDate - aDate;
        }
        return a.name.localeCompare(b.name);
      });

    return { filteredWorkers: list, ratedCount: ratedWorkers, unratedCount: unratedWorkers };
  }, [workers, searchTerm, filterStatus, sortBy, isAlreadyRated]);

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

      <div className="page-header">
        <h1>{t("supervisorRatings.title")}</h1>
        <p>{t("supervisorRatings.subtitle")}</p>
      </div>

      <div className="wf-filter-bar">
        <div className="wf-filter-inputs">
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
      </div>

      <div className="details-stats-row">
        <div className="quick-stat-pill">
          <span className="label">{t("supervisorRatings.visibleWorkers")}</span>
          <span className="value">{filteredWorkers.length}</span>
        </div>
        <div className="quick-stat-pill">
          <span className="label">{t("supervisorRatings.ratedInMonth")}</span>
          <span className="value">{ratedCount}</span>
        </div>
        <div className="quick-stat-pill">
          <span className="label">{t("supervisorRatings.notYetRated")}</span>
          <span className="value">{unratedCount}</span>
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

        <div className="quick-stat-pill">
          <span className="label">{t("supervisorRatings.viewingMonth")}</span>
          <span className="value">{formatMonthLabel(selectedMonth)}</span>
        </div>
      </div>

      {loading ? (
        <div className="loading">{t("supervisorRatings.loadingWorkers")}</div>
      ) : filteredWorkers.length === 0 ? (
        <div className="no-data">
          {searchTerm ? t("supervisorRatings.noWorkersSearch") : t("supervisorRatings.noWorkersDisplay")}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="workers-table supervisor-ratings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("supervisorRatings.name")}</th>
                <th>{t("supervisorRatings.email")}</th>
                <th>{t("supervisorRatings.avgRating")}</th>
                <th>{t("supervisorRatings.sessions")}</th>
                <th>{t("supervisorRatings.status")}</th>
                <th>{t("supervisorRatings.latestRating")}</th>
                <th>{t("supervisorRatings.selectedMonth")}</th>
                <th>{t("supervisorRatings.lastComment")}</th>
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
                  <td className="worker-email" data-label={t("supervisorRatings.email")}>{worker.email}</td>
                  <td data-label={t("supervisorRatings.avgRating")}>
                    {typeof worker.monthAverageRating === "number" ? (
                      <span
                        className="rating-badge"
                        style={{ backgroundColor: getRatingColor(worker.monthAverageRating) }}
                      >
                        {Number(worker.monthAverageRating).toFixed(1)} *
                      </span>
                    ) : (
                      <span className="rating-badge rating-badge--none">-</span>
                    )}
                  </td>
                  <td className="center" data-label={t("supervisorRatings.sessions")}>{worker.totalRatings}</td>
                  <td className="center" data-label={t("supervisorRatings.status")}>
                    <span className={`status-badge ${getRatingStatus(worker.averageRating).toLowerCase().replace(/\s+/g, "-")}`}>
                      {getRatingStatus(worker.averageRating)}
                    </span>
                  </td>
                  <td className="latest-rating-cell" data-label={t("supervisorRatings.latestRating")}>
                    {worker.latestRating ? (() => {
                      const scores = KPI_FIELDS.map((f) => worker.latestRating[f.key] ?? 0);
                      const avg = scores.reduce((a, b) => a + b, 0) / KPI_FIELDS.length;
                      const lowest = KPI_FIELDS
                        .map((f) => ({ ...f, value: worker.latestRating[f.key] ?? 0 }))
                        .sort((a, b) => a.value - b.value)[0];
                      return (
                        <div className="rating-summary">
                          <div
                            className="summary-avg"
                            style={{ backgroundColor: getRatingColor(avg) }}
                          >
                            {avg.toFixed(1)} {t("supervisorRatings.avgShort")}
                          </div>
                          <div className="summary-low">
                            {t("supervisorRatings.lowShort")} {t(`kpiShort.${lowest.key}`)}: {lowest.value}
                          </div>
                          <small className="rating-timestamp">
                            {formatDate(worker.latestRating.createdAt)}
                            {ratedThisMonth(worker) && (
                              <span className="today-tag">{t("supervisorRatings.selectedMonthTag")}</span>
                            )}
                          </small>
                        </div>
                      );
                    })() : (
                      <span className="text-muted">{t("supervisorRatings.noRatingsYet")}</span>
                    )}
                  </td>
                  <td className="action-cell" data-label={t("supervisorRatings.action")}>
                    {isAlreadyRated(worker._id) ? (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleEditWorker(worker)}
                        title={`Edit this worker's rating for ${selectedMonth}`}
                      >
                        {t("supervisorRatings.edit")}
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleRateWorker(worker)}
                        title={`Rate this worker for ${selectedMonth}`}
                      >
                        {t("supervisorRatings.rate")}
                      </button>
                    )}
                  </td>
                  <td className="comment-cell" data-label={t("supervisorRatings.lastComment")}>
                    {worker.latestRating?.comment ? (
                      <div className="comment-preview" title={worker.latestRating.comment}>
                        <span className="comment-text">
                          {worker.latestRating.comment.substring(0, 40)}
                          {worker.latestRating.comment.length > 40 ? "..." : ""}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted">{t("supervisorRatings.dash")}</span>
                    )}
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