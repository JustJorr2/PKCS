import { useState, useEffect, useMemo, useCallback } from "react";
import { supervisorService } from "../../services/api";
import { getRatingColor } from "../../utils/helpers";
import "../../styles/Supervisor/SupervisorPages.css";
import "../../styles/common/ConfirmDialog.css";
import { useLanguage } from "../../context/LanguageContext";
import { Users, Star, Trophy, AlertTriangle, Info } from "lucide-react";

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

function getLastMonthKey() {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
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

function getFieldVariation(rating) {
  const values = ratingFields.map((f) => ({
    ...f,
    value: Number(rating[f.key]) || 0
  }));

  const sortedDesc = [...values].sort((a, b) => b.value - a.value);
  const highest = sortedDesc[0];
  const lowest = sortedDesc[sortedDesc.length - 1];

  return { highest, lowest };
}

function SupervisorHome({ worker }) {
  const { t } = useLanguage();

  const [allTimeWorkers, setAllTimeWorkers] = useState([]);
  const [lastMonthWorkers, setLastMonthWorkers] = useState([]);
  const [monthlyRatings, setMonthlyRatings] = useState([]);

  const [loading, setLoading] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [filterMode, setFilterMode] = useState("lastMonth");
  const [showBelowTwoDetails, setShowBelowTwoDetails] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const monthKeys = getRecentMonthKeys(RECENT_MONTHS_LIMIT);

      const [allTimeRes, lastMonthRes, ...monthlyResponses] = await Promise.all([
        supervisorService.getDashboard(undefined, worker?._id),
        supervisorService.getDashboard(getLastMonthKey(), worker?._id),
        ...monthKeys.map((monthKey) => supervisorService.getDashboard(monthKey, worker?._id))
      ]);

      setAllTimeWorkers(allTimeRes.data || []);
      setLastMonthWorkers(lastMonthRes.data || []);

      const monthlyData = monthlyResponses.map((response, index) => ({
        monthKey: monthKeys[index],
        workers: response.data || []
      }));

      setMonthlyRatings(monthlyData);
    } catch (err) {
      console.error("Error fetching home data:", err);
      setAllTimeWorkers([]);
      setLastMonthWorkers([]);
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
   * Last Month:
   *   lastMonthWorkers + monthAverageRating
   *
   * Cumulative:
   *   allTimeWorkers + cumulativeAverageRating
   */
  const activeWorkers = filterMode === "lastMonth" ? lastMonthWorkers : allTimeWorkers;

  const getFilteredRating = useCallback(
    (w) => {
      const raw = filterMode === "lastMonth" ? w.monthAverageRating : w.cumulativeAverageRating;
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
   * Last Month -> last month only
   * Cumulative -> all recent monthly groups
   */
  const visibleRatingsByMonth = useMemo(() => {
    if (filterMode === "lastMonth") {
      const lastMonthKey = getLastMonthKey();
      return ratingsByMonth.filter((month) => month.monthKey === lastMonthKey);
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
    const belowTwoCandidates =
      filterMode === "lastMonth"
        ? activeWorkers.filter((w) => {
            const r = getFilteredRating(w);
            return r !== null && r > 0 && r < BELOW_THRESHOLD;
          })
        : activeWorkers.filter((w) => (w.lowRatingHistory || []).length > 0);

    const belowTwoWorkers = belowTwoCandidates
      .map((w) => ({
        worker: w,
        history: [...(w.lowRatingHistory || [])].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        )
      }))
      .sort((a, b) => {
        if (filterMode === "lastMonth") {
          return getFilteredRating(a.worker) - getFilteredRating(b.worker);
        }

        // Cumulative: repeat offenders first, then worst single score.
        if (b.history.length !== a.history.length) {
          return b.history.length - a.history.length;
        }

        const aWorst = Math.min(...a.history.map((h) => h.average));
        const bWorst = Math.min(...b.history.map((h) => h.average));
        return aWorst - bWorst;
      });

    return {
      totalWorkers: activeWorkers.length,
      avgRating: avgRatingRaw.toFixed(2),
      ratedWorkers: ratedWorkersList.length,
      unratedWorkers,
      topWorker,
      belowTwoWorkers,
    };
  }, [activeWorkers, getFilteredRating, filterMode]);

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
    filterMode === "lastMonth"
      ? t("supervisorHome.filterLastMonth") || "Last Month"
      : t("supervisorHome.filterCumulative") || "Cumulative";

  return (
    <div className="page-content supervisor-home">

      <div className="page-header">
        <h3>          
          {filterMode === "lastMonth"
            ? `${t("supervisorHome.overviewMonth")} ${monthLabelFor(
              getLastMonthKey()
            )}.`
            : t("supervisorHome.overviewCumulative")}
        </h3>
      </div>

      {/* FILTER */}
      <div className="supervisor-home-filter" style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button
          type="button"
          onClick={() => setFilterMode("lastMonth")}
          style={{
            padding: "8px 16px",
            borderRadius: "20px",
            border: filterMode === "lastMonth" ? "1px solid #2f80ed" : "1px solid #d1d5db",
            background: filterMode === "lastMonth" ? "#2f80ed" : "#ffffff",
            color: filterMode === "lastMonth" ? "#ffffff" : "#374151",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          {t("supervisorHome.filterLastMonth") || "Last Month"}
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
          <div className="stat-icon"><Users size={20} /></div>
          <div className="stat-info">
            <h3>{t("supervisorHome.totalWorkers")}</h3>
            <p className="stat-number">{dashboard.totalWorkers}</p>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon"><Star size={20} /></div>
          <div className="stat-info">
            <h3>{t("supervisorHome.averageRating")}</h3>
            <p className="stat-number" style={{ color: getRatingColor(Number(dashboard.avgRating)) }}>
              {dashboard.avgRating} ★
            </p>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon"><Trophy size={20} /></div>
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
                {(getFilteredRating(dashboard.topWorker) || 0).toFixed(2)} ★
              </p>
            )}
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon"><AlertTriangle size={20} /></div>
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
          <div
            className="confirm-dialog-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              flexDirection: "column",
              maxHeight: "80vh",
              width: "min(480px, 92vw)"
            }}
          >
            <h3 style={{ marginBottom: "4px" }}>
              {t("supervisorHome.belowTwoTitle") || "Workers Below 2.0"} — {filterLabel}
            </h3>

            {dashboard.belowTwoWorkers.length === 0 ? (
              <p>{t("supervisorHome.noWorkersBelowTwo") || "No workers below 2.0 right now."}</p>
            ) : (
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  marginTop: "10px",
                  paddingRight: "4px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px"
                }}
              >
                {dashboard.belowTwoWorkers.map(({ worker: w, history }) => {
                  const rating = getFilteredRating(w) || 0;

                  return (
                    <div
                      key={w._id}
                      style={{
                        background: "#f9fafb",
                        borderRadius: "10px",
                        padding: "10px 12px"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <span style={{ color: "#111827", fontWeight: 600 }}>{w.name}</span>
                        <span style={{ color: getRatingColor(rating), fontWeight: 700 }}>
                          {rating.toFixed(2)} ★
                        </span>
                      </div>

                      {history.length > 0 && (
                        <div
                          style={{
                            marginTop: "6px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "3px"
                          }}
                        >
                          <span
                            style={{
                              fontSize: "11px",
                              color: "#9ca3af",
                              textTransform: "uppercase",
                              letterSpacing: "0.03em"
                            }}
                          >
                            {t("supervisorHome.lowRatingHistory") || "Months below 2.0"}
                          </span>

                          {history.map((h, i) => (
                            <div
                              key={`${w._id}-${h.dateKey}-${i}`}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "13px",
                                color: "#4b5563"
                              }}
                            >
                              <span>{monthLabelFor(h.dateKey)}</span>
                              <span style={{ color: getRatingColor(h.average), fontWeight: 600 }}>
                                {h.average.toFixed(2)} ★
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="confirm-dialog-actions" style={{ marginTop: "12px" }}>
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
                        ).toFixed(2);

                        const { highest, lowest } = getFieldVariation(item.rating);

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

                            <div className="recent-rating" style={{ flex: 1, display: "flex", flexDirection: "column", marginLeft: "24px" }}>
                              <div
                                className="rating-fields-small"
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  width: "100%"
                                }}
                              >
                                <span
                                  className="field-badge main"
                                  style={{ backgroundColor: getRatingColor(Number(ratingAvg)), color: "#fff" }}
                                >
                                  AVG: {ratingAvg} ★
                                </span>

                                <div style={{ display: "flex", gap: "8px" }}>
                                  <span
                                    className="field-badge"
                                    style={{ backgroundColor: getRatingColor(highest.value), color: "#fff" }}
                                    title={t("supervisorHome.highest") || "Highest"}
                                  >
                                    ↑ {t(`kpiShort.${highest.key}`)}: {highest.value} ★
                                  </span>

                                  <span
                                    className="field-badge"
                                    style={{ backgroundColor: getRatingColor(lowest.value), color: "#fff" }}
                                    title={t("supervisorHome.weakest") || "Weakest"}
                                  >
                                    ↓ {t(`kpiShort.${lowest.key}`)}: {lowest.value} ★
                                  </span>
                                </div>
                              </div>

                              <p className="recent-time">
                                {new Date(item.rating.createdAt).toLocaleString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: false
                                })}
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
      </div>

      {/* LEGEND */}
      <div className="legend-box bottom">
        <div className="legend-header" onClick={() => setShowLegend((prev) => !prev)}>
          <span className="legend-title">
            <Info size={16} style={{ marginRight: "6px", verticalAlign: "-3px" }} />
            {t("supervisorHome.legendTitle")}
          </span>
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