import { useState, useEffect, useMemo, useCallback } from "react";
import { supervisorService } from "../../services/api";
import { getRatingColor } from "../../utils/helpers";
import "../../styles/Supervisor/SupervisorPages.css";
import "../../styles/common/ConfirmDialog.css";
import { useLanguage } from "../../context/LanguageContext";

const ratingFields = [
  { key: "workAreaCompliance", short: "WA" },
  { key: "taskCompletion", short: "TC" },
  { key: "cleanliness", short: "CL" },
  { key: "wasteManagement", short: "WM" },
  { key: "organization", short: "OR" },
  { key: "uniformCompliance", short: "UC" },
  { key: "independence", short: "IN" },
  { key: "initiative", short: "IV" },
  { key: "teamworkSupport", short: "TS" },
  { key: "punctuality", short: "PU" },
  { key: "attendance", short: "AT" },
  { key: "leaveOnTime", short: "LT" }
];

const BELOW_THRESHOLD = 2.0;
const RECENT_MONTHS_LIMIT = 6;

function getCurrentMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getRecentMonthKeys(count = RECENT_MONTHS_LIMIT) {
  const keys = [];
  const now = new Date();

  // Start at 0 so the CURRENT month is included.
  for (let i = 0; i < count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    keys.push(`${year}-${month}`);
  }

  return keys;
}

function monthLabelFor(monthKey) {
  return /^\d{4}-\d{2}$/.test(monthKey)
    ? new Date(`${monthKey}-01`).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long"
      })
    : monthKey;
}

// Given the 12 KPI values for a single rating, pick 3 fields to display as a
// spread: the worker's strongest field, one close to their own average,
// and their weakest field.
function getFieldVariation(rating) {
  const values = ratingFields.map((f) => ({
    ...f,
    value: Number(rating[f.key]) || 0
  }));

  const sortedDesc = [...values].sort((a, b) => b.value - a.value);
  const highest = sortedDesc[0];
  const lowest = sortedDesc[sortedDesc.length - 1];
  const mean = values.reduce((sum, f) => sum + f.value, 0) / values.length;

  const middleCandidates = values.filter(
    (f) => f.key !== highest.key && f.key !== lowest.key
  );
  const pool = middleCandidates.length ? middleCandidates : values;

  const middle = pool.reduce(
    (best, f) => (Math.abs(f.value - mean) < Math.abs(best.value - mean) ? f : best),
    pool[0]
  );

  return { highest, middle, lowest };
}

function SupervisorHome({ worker }) {
  const { t } = useLanguage();

  const [allTimeWorkers, setAllTimeWorkers] = useState([]);
  const [thisMonthWorkers, setThisMonthWorkers] = useState([]);
  const [monthlyRatings, setMonthlyRatings] = useState([]);

  const [loading, setLoading] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [filterMode, setFilterMode] = useState("month");
  const [showBelowTwoDetails, setShowBelowTwoDetails] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const monthKeys = getRecentMonthKeys(RECENT_MONTHS_LIMIT);

      /*
       * We fetch:
       *
       * 1. All-time dashboard
       * 2. Current month dashboard
       * 3. Recent individual months for the cumulative
       *    Recent Ratings section.
       *
       * The current month is monthKeys[0].
       */
      const [allTimeRes, thisMonthRes, ...monthlyResponses] = await Promise.all([
        supervisorService.getDashboard(undefined, worker?._id),
        supervisorService.getDashboard(getCurrentMonthKey(), worker?._id),
        ...monthKeys.map((monthKey) => supervisorService.getDashboard(monthKey, worker?._id))
      ]);

      setAllTimeWorkers(allTimeRes.data || []);
      setThisMonthWorkers(thisMonthRes.data || []);

      const monthlyData = monthlyResponses.map((response, index) => ({
        monthKey: monthKeys[index],
        workers: response.data || []
      }));

      setMonthlyRatings(monthlyData);
    } catch (err) {
      console.error("Error fetching home data:", err);
      setAllTimeWorkers([]);
      setThisMonthWorkers([]);
      setMonthlyRatings([]);
    } finally {
      setLoading(false);
    }
  }, [worker?._id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /*
   * The main dashboard cards use either:
   *
   * This Month:
   *   thisMonthWorkers + monthAverageRating
   *
   * Cumulative:
   *   allTimeWorkers + cumulativeAverageRating
   */
  const activeWorkers = filterMode === "month" ? thisMonthWorkers : allTimeWorkers;

  const getFilteredRating = useCallback(
    (w) => {
      const raw = filterMode === "month" ? w.monthAverageRating : w.cumulativeAverageRating;
      return raw === null || raw === undefined ? null : Number(raw);
    },
    [filterMode]
  );

  /*
   * Build the monthly Recent Ratings data.
   *
   * Each month's API response contains the latest rating
   * for each worker for that particular month.
   */
  const ratingsByMonth = useMemo(() => {
    return monthlyRatings
      .map(({ monthKey, workers: monthWorkers }) => {
        const entries = monthWorkers
          .filter((w) => w.latestRating)
          .sort((a, b) => new Date(b.latestRating.createdAt) - new Date(a.latestRating.createdAt))
          .map((w) => ({ worker: w, rating: w.latestRating }));

        return { monthKey, monthLabel: monthLabelFor(monthKey), entries };
      })
      .filter((month) => month.entries.length > 0);
  }, [monthlyRatings]);

  /*
   * What appears in Recent Ratings depends on the filter:
   *
   * This Month -> current month only
   * Cumulative -> all recent monthly groups
   */
  const visibleRatingsByMonth = useMemo(() => {
    if (filterMode === "month") {
      const currentMonthKey = getCurrentMonthKey();
      return ratingsByMonth.filter((month) => month.monthKey === currentMonthKey);
    }

    return ratingsByMonth;
  }, [ratingsByMonth, filterMode]);

  const dashboard = useMemo(() => {
    if (!activeWorkers.length) {
      return {
        totalWorkers: 0,
        avgRating: "0.00",
        ratedWorkers: 0,
        unratedWorkers: 0,
        topWorker: null,
        belowTwoWorkers: [],
        updatedInLastWeek: 0,
        belowThreeCount: 0
      };
    }

    const ratedWorkersList = activeWorkers.filter((w) => getFilteredRating(w) !== null);
    const unratedWorkers = activeWorkers.length - ratedWorkersList.length;

    const avgRatingRaw =
      activeWorkers.reduce((sum, w) => sum + (getFilteredRating(w) || 0), 0) /
      activeWorkers.length;

    const sortedRated = [...ratedWorkersList].sort(
      (a, b) => (getFilteredRating(b) || 0) - (getFilteredRating(a) || 0)
    );

    const topWorker = sortedRated[0] || null;

    const belowTwoWorkers = ratedWorkersList
      .filter((w) => {
        const r = getFilteredRating(w);
        return r !== null && r > 0 && r <= BELOW_THRESHOLD;
      })
      .sort((a, b) => getFilteredRating(a) - getFilteredRating(b));

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    const updatedInLastWeek = activeWorkers.filter((w) => {
      if (!w.latestRating?.createdAt) return false;
      const created = new Date(w.latestRating.createdAt).getTime();
      return now - created <= sevenDaysMs;
    }).length;

    const belowThreeCount = ratedWorkersList.filter((w) => {
      const r = getFilteredRating(w);
      return r !== null && r > 0 && r < 3;
    }).length;

    return {
      totalWorkers: activeWorkers.length,
      avgRating: avgRatingRaw.toFixed(2),
      ratedWorkers: ratedWorkersList.length,
      unratedWorkers,
      topWorker,
      belowTwoWorkers,
      updatedInLastWeek,
      belowThreeCount
    };
  }, [activeWorkers, getFilteredRating]);

  const toggleMonth = (monthKey) => {
    setExpandedMonths((prev) => ({ ...prev, [monthKey]: !prev[monthKey] }));
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading">{t("supervisorHome.loading")}</div>
      </div>
    );
  }

  const filterLabel =
    filterMode === "month"
      ? t("supervisorHome.filterThisMonth") || "This Month"
      : t("supervisorHome.filterCumulative") || "Cumulative";

  return (
    <div className="page-content supervisor-home">
      <div className="page-header">
        <h1>{t("supervisorHome.welcomeBack")}</h1>
        <p>{t("supervisorHome.overview")}</p>
      </div>

      {/* FILTER */}
      <div className="supervisor-home-filter" style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button
          type="button"
          onClick={() => setFilterMode("month")}
          style={{
            padding: "8px 16px",
            borderRadius: "20px",
            border: filterMode === "month" ? "1px solid #2f80ed" : "1px solid #d1d5db",
            background: filterMode === "month" ? "#2f80ed" : "#ffffff",
            color: filterMode === "month" ? "#ffffff" : "#374151",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          {t("supervisorHome.filterThisMonth") || "This Month"}
        </button>

        <button
          type="button"
          onClick={() => setFilterMode("cumulative")}
          style={{
            padding: "8px 16px",
            borderRadius: "20px",
            border: filterMode === "cumulative" ? "1px solid #2f80ed" : "1px solid #d1d5db",
            background: filterMode === "cumulative" ? "#2f80ed" : "#ffffff",
            color: filterMode === "cumulative" ? "#ffffff" : "#374151",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          {t("supervisorHome.filterCumulative") || "Cumulative"}
        </button>
      </div>

      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <h3>{t("supervisorHome.totalWorkers")}</h3>
            <p className="stat-number">{dashboard.totalWorkers}</p>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">⭐</div>
          <div className="stat-info">
            <h3>{t("supervisorHome.averageRating")}</h3>
            <p className="stat-number" style={{ color: getRatingColor(Number(dashboard.avgRating)) }}>
              {dashboard.avgRating} ★
            </p>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon">🏆</div>
          <div className="stat-info">
            <h3>{t("supervisorHome.topPerformer")}</h3>
            <p className="stat-text">
              {dashboard.topWorker?.name || t("supervisorHome.notAvailable")}
            </p>

            {dashboard.topWorker && (
              <p
                className="stat-meta"
                style={{ color: getRatingColor(getFilteredRating(dashboard.topWorker) || 0) }}
              >
                {(getFilteredRating(dashboard.topWorker) || 0).toFixed(1)} ★
              </p>
            )}
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <h3>{t("supervisorHome.belowTwoTitle") || "Workers Below 2.0"}</h3>
            <p className="stat-number" style={{ color: "#e74c3c" }}>
              {dashboard.belowTwoWorkers.length}
            </p>

            <button
              type="button"
              onClick={() => setShowBelowTwoDetails(true)}
              style={{
                marginTop: "4px",
                background: "none",
                border: "none",
                color: "#2f80ed",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline"
              }}
            >
              {t("supervisorHome.seeDetails") || "See details"}
            </button>
          </div>
        </div>
      </div>

      {/* BELOW 2.0 MODAL */}
      {showBelowTwoDetails && (
        <div className="confirm-dialog-overlay" onClick={() => setShowBelowTwoDetails(false)}>
          <div className="confirm-dialog-card" onClick={(e) => e.stopPropagation()}>
            <h3>
              {t("supervisorHome.belowTwoTitle") || "Workers Below 2.0"} — {filterLabel}
            </h3>

            {dashboard.belowTwoWorkers.length === 0 ? (
              <p>{t("supervisorHome.noWorkersBelowTwo") || "No workers below 2.0 right now."}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
                {dashboard.belowTwoWorkers.map((w) => {
                  const rating = getFilteredRating(w) || 0;

                  return (
                    <div
                      key={w._id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: "1px solid #f3f4f6",
                        paddingBottom: "8px"
                      }}
                    >
                      <span style={{ color: "#111827", fontWeight: 500 }}>{w.name}</span>
                      <span style={{ color: getRatingColor(rating), fontWeight: 700 }}>
                        {rating.toFixed(2)} ★
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="confirm-dialog-actions">
              <button type="button" className="btn" onClick={() => setShowBelowTwoDetails(false)}>
                {t("common.close") || "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECENT RATINGS */}
      <div className="recent-section">
        <h2>
          {t("supervisorHome.recentRatings")}{" "}
          <span style={{ fontWeight: 400, fontSize: "14px", color: "#6b7280" }}>
            ({filterLabel})
          </span>
        </h2>

        {visibleRatingsByMonth.length > 0 ? (
          <div className="recent-list-by-month">
            {visibleRatingsByMonth.map((month, index) => {
              // Latest month opens automatically. Older months are collapsed.
              const isExpanded = expandedMonths[month.monthKey] ?? index === 0;

              return (
                <div key={month.monthKey} className="month-group">
                  {/* MONTH HEADER */}
                  <div className="month-group-header" onClick={() => toggleMonth(month.monthKey)}>
                    <div>
                      <h3 className="month-group-title">{month.monthLabel}</h3>
                      <span className="month-rating-count">
                        {month.entries.length} {month.entries.length === 1 ? "rating" : "ratings"}
                      </span>
                    </div>

                    <span className="month-toggle">{isExpanded ? "▲" : "▼"}</span>
                  </div>

                  {/* MONTH CONTENT */}
                  {isExpanded && (
                    <div className="recent-list">
                      {month.entries.map((item, idx) => {
                        const ratingAvg = (
                          ratingFields.reduce((sum, f) => sum + (Number(item.rating[f.key]) || 0), 0) /
                          ratingFields.length
                        ).toFixed(1);

                        const { highest, middle, lowest } = getFieldVariation(item.rating);

                        return (
                          <div
                            key={`${item.worker._id}-${item.rating.createdAt}-${idx}`}
                            className="recent-item"
                          >
                            <div className="recent-worker">
                              <div className="worker-avatar">
                                {item.worker.name?.charAt(0).toUpperCase()}
                              </div>

                              <div className="worker-details">
                                <h4>{item.worker.name}</h4>
                                <p className="worker-email">{item.worker.email}</p>
                              </div>
                            </div>

                            <div className="recent-rating">
                              <div className="rating-fields-small">
                                <span
                                  className="field-badge main"
                                  style={{ backgroundColor: getRatingColor(Number(ratingAvg)), color: "#fff" }}
                                >
                                  AVG: {ratingAvg} ★
                                </span>

                                <span
                                  className="field-badge"
                                  style={{ backgroundColor: getRatingColor(highest.value), color: "#fff" }}
                                  title={t("supervisorHome.highest") || "Highest"}
                                >
                                  ↑ {t(`kpiShort.${highest.key}`)}: {highest.value} ★
                                </span>

                                <span
                                  className="field-badge"
                                  style={{ backgroundColor: getRatingColor(middle.value), color: "#fff" }}
                                  title={t("supervisorHome.average") || "Average"}
                                >
                                  • {t(`kpiShort.${middle.key}`)}: {middle.value} ★
                                </span>

                                <span
                                  className="field-badge"
                                  style={{ backgroundColor: getRatingColor(lowest.value), color: "#fff" }}
                                  title={t("supervisorHome.weakest") || "Weakest"}
                                >
                                  ↓ {t(`kpiShort.${lowest.key}`)}: {lowest.value} ★
                                </span>
                              </div>

                              <p className="recent-time">
                                {new Date(item.rating.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="no-data">{t("supervisorHome.noRatings")}</p>
        )}
      </div>

      {/* QUICK STATS */}
      <div className="quick-stats">
        <div className="quick-stat">
          <span className="label">{t("supervisorHome.workersRated")}</span>
          <span className="value">{dashboard.ratedWorkers}</span>
        </div>

        <div className="quick-stat">
          <span className="label">{t("supervisorHome.workersNotRated")}</span>
          <span className="value">{dashboard.unratedWorkers}</span>
        </div>

        <div className="quick-stat">
          <span className="label">{t("supervisorHome.updated7Days")}</span>
          <span className="value">{dashboard.updatedInLastWeek}</span>
        </div>

        <div className="quick-stat">
          <span className="label">{t("supervisorHome.belowThree")}</span>
          <span className="value">{dashboard.belowThreeCount}</span>
        </div>
      </div>

      {/* LEGEND */}
      <div className="legend-box bottom">
        <div className="legend-header" onClick={() => setShowLegend((prev) => !prev)}>
          <span className="legend-title">ℹ️ {t("supervisorHome.legendTitle")}</span>
          <span className="legend-toggle">
            {showLegend ? `▲ ${t("supervisorHome.hide")}` : `▼ ${t("supervisorHome.show")}`}
          </span>
        </div>

        {showLegend && (
          <div className="legend-grid">
            {ratingFields.map((f) => (
              <div key={f.key} className="legend-item">
                <span className="legend-short">{t(`kpiShort.${f.key}`)}</span>
                <span className="legend-label">{t(`kpi.${f.key}`)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SupervisorHome;