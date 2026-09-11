import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ClipboardList,
  Star,
  Tag,
  Inbox,
  AlertTriangle,
  Filter,
  X
} from "lucide-react";
import { supervisorService } from "../../services/api";
import { getRatingColor, getRatingStatus } from "../../utils/helpers";
import { useLanguage } from "../../context/LanguageContext";
import "../../styles/common/WorkerInformation.css";

const KPI_KEYS = [
  "workAreaCompliance",
  "taskCompletion",
  "cleanliness",
  "wasteManagement",
  "organization",
  "uniformCompliance",
  "independence",
  "initiative",
  "teamworkSupport",
  "punctuality",
  "attendance"
];

const ALL_VALUE = "__all__";

function formatMonthKey(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long"
  });
}

function WorkerInformation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  const [worker, setWorker] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState(new Set());

  const [raterFilter, setRaterFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState(ALL_VALUE);

  const fetchWorker = useCallback(async () => {
    try {
      setLoading(true);
      const res = await supervisorService.getWorkerById(id);
      setWorker(res.data.worker);
      setRatings(res.data.ratings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchWorker();
  }, [fetchWorker]);

  const toggleCard = (id) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Build the list of rater names for the autocomplete suggestions
  const raterOptions = useMemo(() => {
    const names = new Set();
    ratings.forEach(r => {
      const name = r.ratedBy?.name;
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [ratings]);

  // Build the list of months available to filter by
  const monthOptions = useMemo(() => {
    const map = new Map();
    ratings.forEach(r => {
      const key = r.dateKey || null;
      if (key && !map.has(key)) {
        map.set(key, formatMonthKey(key) || key);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([value, label]) => ({ value, label }));
  }, [ratings]);

  const filteredRatings = useMemo(() => {
    const raterQuery = raterFilter.trim().toLowerCase();
    return ratings.filter(r => {
      const raterName = (r.ratedBy?.name ?? "").toLowerCase();
      const raterMatch = raterQuery === "" || raterName.includes(raterQuery);
      const monthMatch = monthFilter === ALL_VALUE || r.dateKey === monthFilter;
      return raterMatch && monthMatch;
    });
  }, [ratings, raterFilter, monthFilter]);

  const hasActiveFilters = raterFilter.trim() !== "" || monthFilter !== ALL_VALUE;

  const clearFilters = () => {
    setRaterFilter("");
    setMonthFilter(ALL_VALUE);
  };

  if (loading) return (
    <div className="wi-loading-screen">
      <div className="wi-spinner" />
      <p>{t("workerInformation.loadingProfile")}</p>
    </div>
  );

  if (!worker) return (
    <div className="wi-error-screen">
      <AlertTriangle size={28} className="wi-error-icon" aria-hidden="true" />
      <p>{t("workerInformation.workerNotFound")}</p>
      <button className="wi-back-btn" onClick={() => navigate(-1)}>
        <ChevronLeft size={16} aria-hidden="true" /> {t("workerInformation.goBack")}
      </button>
    </div>
  );

  const avgRating = worker.averageRating;
  const hasRatings = worker.totalRatings > 0;

  return (
    <div className="worker-info-page">

      {/* BREADCRUMB / BACK */}
      <nav className="wi-breadcrumb">
        <button className="wi-back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} aria-hidden="true" />
          {t("workerInformation.back")}
        </button>
        <span className="wi-crumb-sep">/</span>
        <span className="wi-crumb-inactive">{t("workerInformation.workers")}</span>
        <span className="wi-crumb-sep">/</span>
        <span className="wi-crumb-active">{worker.name}</span>
      </nav>

      {/* HERO HEADER */}
      <div className="wi-hero">
        <div className="wi-avatar" style={{ background: getRatingColor(avgRating) || "#4f46e5" }}>
          {worker.name.charAt(0).toUpperCase()}
        </div>
        <div className="wi-hero-info">
          <h1 className="wi-hero-name">{worker.name}</h1>
          <p className="wi-hero-email">{worker.email}</p>
          {hasRatings && (
            <div className="wi-hero-status">
              <span
                className="wi-status-dot"
                style={{ background: getRatingColor(avgRating) }}
              />
              {getRatingStatus(avgRating, language)}
            </div>
          )}
        </div>
        {hasRatings && (
          <div className="wi-hero-score" style={{ borderColor: getRatingColor(avgRating) }}>
            <span className="wi-score-num" style={{ color: getRatingColor(avgRating) }}>
              {avgRating.toFixed(1)}
            </span>
            <Star size={16} className="wi-score-star" fill="currentColor" aria-hidden="true" />
            <span className="wi-score-label">{t("workerInformation.avg")}</span>
          </div>
        )}
      </div>

      {/* STATS ROW */}
      <div className="wi-stats">
        <div className="wi-stat-card">
          <div className="wi-stat-icon">
            <ClipboardList size={20} aria-hidden="true" />
          </div>
          <div>
            <div className="wi-stat-value">{worker.totalRatings}</div>
            <div className="wi-stat-label">{t("workerInformation.totalSessions")}</div>
          </div>
        </div>
        <div className="wi-stat-card">
          <div className="wi-stat-icon">
            <Star size={20} aria-hidden="true" />
          </div>
          <div>
            <div className="wi-stat-value" style={{ color: hasRatings ? getRatingColor(avgRating) : undefined }}>
              {hasRatings ? avgRating.toFixed(1) : "—"}
            </div>
            <div className="wi-stat-label">{t("workerInformation.averageScore")}</div>
          </div>
        </div>
        <div className="wi-stat-card">
          <div className="wi-stat-icon">
            <Tag size={20} aria-hidden="true" />
          </div>
          <div>
            <div className="wi-stat-value wi-stat-status">{getRatingStatus(avgRating)}</div>
            <div className="wi-stat-label">{t("workerInformation.performance")}</div>
          </div>
        </div>
      </div>

      {/* RATING HISTORY */}
      <div className="wi-history">
        <div className="wi-history-header">
          <h2>{t("workerInformation.ratingHistory")}</h2>
          {filteredRatings.length > 0 && (
            <span className="wi-history-count">
              {filteredRatings.length} {filteredRatings.length !== 1 ? t("workerInformation.months") : t("workerInformation.month")}
            </span>
          )}
        </div>

        {/* FILTERS */}
        {ratings.length > 0 && (
          <div className="wi-filters">
            <div className="wi-filter-group">
              <Filter size={14} className="wi-filter-icon" aria-hidden="true" />
              <input
                type="text"
                className="wi-filter-input"
                list="wi-rater-options"
                placeholder={t("workerInformation.filterByRater") || "Filter by rater"}
                value={raterFilter}
                onChange={(e) => setRaterFilter(e.target.value)}
                aria-label={t("workerInformation.filterByRater") || "Filter by rater"}
              />
              <datalist id="wi-rater-options">
                {raterOptions.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              {raterFilter && (
                <button
                  type="button"
                  className="wi-filter-input-clear"
                  onClick={() => setRaterFilter("")}
                  aria-label={t("workerInformation.clearFilters") || "Clear"}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="wi-filter-group">
              <select
                className="wi-filter-select"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                aria-label={t("workerInformation.filterByMonth") || "Filter by month"}
              >
                <option value={ALL_VALUE}>
                  {t("workerInformation.allMonths") || "All months"}
                </option>
                {monthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button className="wi-filter-clear" onClick={clearFilters}>
                <X size={14} aria-hidden="true" />
                {t("workerInformation.clearFilters") || "Clear"}
              </button>
            )}
          </div>
        )}

        {filteredRatings.length === 0 ? (
          <div className="wi-empty">
            <Inbox size={32} className="wi-empty-icon" aria-hidden="true" />
            <p>
              {ratings.length === 0
                ? t("workerInformation.noRatingsRecorded")
                : (t("workerInformation.noRatingsMatchFilters") || "No ratings match the selected filters.")}
            </p>
          </div>
        ) : (
          <div className="wi-cards">
            {filteredRatings.map((r, i) => {
              const avg = KPI_KEYS.reduce((sum, key) => sum + (r[key] || 0), 0) / KPI_KEYS.length;
              const isExpanded = expandedCards.has(r._id);
              const monthLabel = formatMonthKey(r.dateKey);

              return (
                <div key={r._id} className="wi-card">
                  {/* Card header — always visible */}
                  <button
                    className="wi-card-header"
                    onClick={() => toggleCard(r._id)}
                    aria-expanded={isExpanded}
                  >
                    <div className="wi-card-left">
                      <span className="wi-card-index">#{filteredRatings.length - i}</span>
                      <div className="wi-card-meta">
                        <span className="wi-card-date">
                          {monthLabel || new Date(r.createdAt).toLocaleDateString(undefined, {
                            year: "numeric", month: "short", day: "numeric"
                          })}
                        </span>
                       <span className="wi-card-ratedby">
                        {t("workerInformation.ratedBy")}: {r.ratedBy?.name ?? t("workerInformation.unknown")}
                      </span>
                      </div>
                    </div>
                    <div className="wi-card-right">
                      <span
                        className="wi-card-avg"
                        style={{ background: getRatingColor(avg), color: "#fff" }}
                      >
                        {avg.toFixed(1)} ★
                      </span>
                      <span className={`wi-card-chevron ${isExpanded ? "wi-card-chevron--open" : ""}`}>
                        ›
                      </span>
                    </div>
                  </button>

                  {/* KPI grid — collapsible */}
                  {isExpanded && (
                    <div className="wi-card-body">
                      <div className="wi-kpi-grid">
                        {KPI_KEYS.map(key => {
                          const val = r[key] ?? 0;
                          return (
                            <div key={key} className="wi-kpi">
                              <span className="wi-kpi-short">
                                {t(`kpiShort.${key}`)}
                              </span>
                              <span
                                className="wi-kpi-val"
                                style={{ color: getRatingColor(val) }}
                              >
                                {val}
                              </span>
                              <span className="wi-kpi-label">
                                {t(`kpi.${key}`)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {r.comment && (
                        <blockquote className="wi-comment">
                          <span className="wi-comment-quote">"</span>
                          {r.comment}
                          <span className="wi-comment-quote">"</span>
                        </blockquote>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkerInformation;