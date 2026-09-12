import { useState, useEffect, useMemo, useCallback } from "react";
import { supervisorService } from "../../services/api";
import { getRatingColor } from "../../utils/helpers";
import "../../styles/User/WorkerDashboard.css";
import { useLanguage } from "../../context/LanguageContext";
import { Star, Trophy, AlertTriangle, Info } from "lucide-react";

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
const RECENT_MONTHS_LIMIT = 6;

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

function WorkerHome({ worker }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [ratingData, setRatingData] = useState([]);
  const [showLegend, setShowLegend] = useState(true);
  const [showMonthlyHistory, setShowMonthlyHistory] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState({});

  const toggleMonth = (monthKey) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [monthKey]: !prev[monthKey],
    }));
  };

  const fetchData = useCallback(async () => {
    if (!worker?._id) return;

    try {
      setLoading(true);
      const response = await supervisorService.getRatingsForUser(worker._id);
      setRatingData(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Error fetching worker ratings:", err);
      setRatingData([]);
    } finally {
      setLoading(false);
    }
  }, [worker?._id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const dashboard = useMemo(() => {
    if (!Array.isArray(ratingData) || ratingData.length === 0) {
      return {
        avgRating: "0.00",
        totalRatings: 0,
        ratingsByMonth: [],
        updatedInLastWeek: 0,
        lowestAreas: [],
        fieldAverages: {},
        monthlyHistory: []
      };
    }

    const ratings = [...ratingData];

    const computeAvg = (list) => {
      if (!list.length) return 0;
      return (
        list.reduce((sum, r) => {
          const values = ratingFields.map((f) => Number(r[f.key]) || 0);
          return sum + values.reduce((a, b) => a + b, 0) / values.length;
        }, 0) / list.length
      );
    };

    const avgRatingRaw = computeAvg(ratings);

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    const updatedInLastWeek = ratings.filter((r) => {
      if (!r.createdAt) return false;
      const created = new Date(r.createdAt).getTime();
      return now - created <= sevenDaysMs;
    }).length;

    const fieldAverages = {};
    ratingFields.forEach((f) => {
      const values = ratings.map((r) => Number(r[f.key]) || 0);
      fieldAverages[f.key] =
        values.length > 0
          ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
          : "0.0";
    });

    const lowestAreas = ratingFields
      .map((f) => ({ ...f, avg: Number(fieldAverages[f.key]) }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 3);

      
    const monthlyMap = ratings.reduce((acc, rating) => {
      const monthKey =
        rating.dateKey ||
        (rating.createdAt
          ? new Date(rating.createdAt).toISOString().slice(0, 7)
          : "Unknown");
      if (!acc[monthKey]) acc[monthKey] = [];
      acc[monthKey].push(rating);
      return acc;
    }, {});

    const sortedMonthKeys = Object.keys(monthlyMap).sort((a, b) =>
      b.localeCompare(a)
    );

    const ratingsByMonth = sortedMonthKeys
      .slice(0, RECENT_MONTHS_LIMIT)
      .map((monthKey) => ({
        monthKey,
        monthLabel: monthLabelFor(monthKey),
        entries: [...monthlyMap[monthKey]].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        )
      }));

    const monthlyHistory = sortedMonthKeys.map((monthKey) => {
      const entries = monthlyMap[monthKey];
      return {
        monthKey,
        monthLabel: monthLabelFor(monthKey),
        count: entries.length,
        average: computeAvg(entries)
      };
    });

    return {
      avgRating: avgRatingRaw.toFixed(2),
      totalRatings: ratings.length,
      ratingsByMonth,
      updatedInLastWeek,
      lowestAreas,
      fieldAverages,
      monthlyHistory
    };
  }, [ratingData]);

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading">{t("workerHome.loading")}</div>
      </div>
    );
  }

  return (
    <div className="page-content worker-dashboard">
      <div className="page-header">
        <h3>{t("workerHome.overview") || "Your performance overview."}</h3>
      </div>

      <div className="stats-grid">
        <div className="stat-card success">
          <div className="stat-icon"><Star size={20} /></div>
          <div className="stat-info">
            <h3>{t("workerHome.avgRating")}</h3>
            <p
              className="stat-number"
              style={{ color: getRatingColor(Number(dashboard.avgRating)) }}
            >
              {dashboard.avgRating} ★
            </p>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon"><Trophy size={20} /></div>
          <div className="stat-info">
            <h3>{t("workerHome.totalReviews")}</h3>
            <p className="stat-number">{dashboard.totalRatings}</p>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon"><AlertTriangle size={20} /></div>
          <div className="stat-info">
            <h3>{t("workerHome.updated7Days")}</h3>
            <p className="stat-number">{dashboard.updatedInLastWeek}</p>
          </div>
        </div>
      </div>

      <div className="recent-section">
        <h2>{t("workerHome.recentRatings")}</h2>

        {dashboard.ratingsByMonth.length > 0 ? (
          <div className="recent-list-by-month">
            {dashboard.ratingsByMonth.map((month, index) => {
              const isExpanded =
                expandedMonths[month.monthKey] ?? index === 0;

              return (
                <div key={month.monthKey} className="month-group">
                  <div
                    className="month-group-header"
                    onClick={() => toggleMonth(month.monthKey)}
                  >
                    <div>
                      <h3 className="month-group-title">
                        {month.monthLabel}
                      </h3>

                      <span className="month-rating-count">
                        {month.entries.length}{" "}
                        {month.entries.length === 1 ? "rating" : "ratings"}
                      </span>
                    </div>

                    <span className="month-toggle">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="recent-list">
                      {month.entries.map((rating, idx) => {
                        const ratingAvg = (
                          ratingFields.reduce(
                            (sum, f) => sum + (Number(rating[f.key]) || 0),
                            0
                          ) / ratingFields.length
                        ).toFixed(2);

                        const { highest, lowest } = getFieldVariation(rating);

                        const isSupervisor =
                          rating.ratedBy?.role === "supervisor";

                        const sourceLabel = isSupervisor
                          ? t("workerHome.supervisor")
                          : t("workerHome.peer");

                        const raterName = isSupervisor
                          ? rating.ratedBy?.name || t("workerHome.teamLead")
                          : t("workerHome.anonymousColleague");

                        return (
                          <div
                            key={`${rating._id}-${idx}`}
                            className="recent-item"
                          >
                            <div className="recent-worker">
                              {isSupervisor && (
                                <div className="worker-avatar">
                                  {(rating.ratedBy?.name || "S")
                                    .charAt(0)
                                    .toUpperCase()}
                                </div>
                              )}

                              <div className="worker-details">
                                <h4>
                                  {sourceLabel} • {raterName}
                                </h4>

                                <p className="worker-email">
                                  {isSupervisor
                                    ? t("workerHome.supervisorRating")
                                    : t("workerHome.peerRating")}
                                </p>
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
                                  style={{
                                    backgroundColor: getRatingColor(Number(ratingAvg)),
                                    color: "#fff"
                                  }}
                                >
                                  AVG: {ratingAvg} ★
                                </span>

                                <div style={{ display: "flex", gap: "8px" }}>
                                  <span
                                    className="field-badge"
                                    style={{
                                      backgroundColor: getRatingColor(highest.value),
                                      color: "#fff"
                                    }}
                                    title={t("workerHome.highest") || "Highest"}
                                  >
                                    ↑ {t(`kpiShort.${highest.key}`)}: {highest.value} ★
                                  </span>

                                  <span
                                    className="field-badge"
                                    style={{
                                      backgroundColor: getRatingColor(lowest.value),
                                      color: "#fff"
                                    }}
                                    title={t("workerHome.weakest") || "Weakest"}
                                  >
                                    ↓ {t(`kpiShort.${lowest.key}`)}: {lowest.value} ★
                                  </span>
                                </div>
                              </div>

                              <p className="recent-time">
                                {new Date(rating.createdAt).toLocaleString(undefined, {
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
          <p className="no-data">{t("workerHome.noRatings")}</p>
        )}
      </div>

      {/* QUICK STATS — total ratings and "updated in last 7 days" already
          live in the stat cards above, so only "needs attention" is left here. */}
      {dashboard.lowestAreas.length > 0 && (
        <div className="quick-stats">
          <div className="quick-stat">
            <span className="label">{t("workerHome.needsAttention")}</span>
            <span className="value">
              {dashboard.lowestAreas.map((f) => t(`kpiShort.${f.key}`)).join(", ")}
            </span>
          </div>
        </div>
      )}

      <div className="legend-box">
        <div
          className="legend-header"
          onClick={() => setShowLegend((prev) => !prev)}
        >
          <span className="legend-title">
            <Info size={16} style={{ marginRight: "6px", verticalAlign: "-3px" }} />
            {t("workerHome.legendTitle")}
          </span>
          <span className="legend-toggle">
            {showLegend
              ? `▲ ${t("workerHome.hide")}`
              : `▼ ${t("workerHome.show")}`}
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

      <div className="recent-section">
        <div
          className="legend-header"
          onClick={() => setShowMonthlyHistory((prev) => !prev)}
          style={{ cursor: "pointer" }}
        >
          <h2 style={{ margin: 0 }}>{t("workerHome.monthlyHistory")}</h2>
          <span className="legend-toggle">
            {showMonthlyHistory
              ? `▲ ${t("workerHome.hide")}`
              : `▼ ${t("workerHome.show")}`}
          </span>
        </div>

        {showMonthlyHistory && (
          dashboard.monthlyHistory.length > 0 ? (
            <>
              <div className="recent-list" style={{ marginTop: "10px" }}>
                {dashboard.monthlyHistory.map((month) => (
                  <div key={month.monthKey} className="recent-item">
                    <div className="recent-worker">
                      <div className="worker-details">
                        <h4>{month.monthLabel}</h4>
                        <p className="worker-email">
                          {month.count}{" "}
                          {month.count !== 1
                            ? t("workerHome.ratingsSuffix")
                            : t("workerHome.ratingSuffix")}
                        </p>
                      </div>
                    </div>

                    <div className="recent-rating">
                      <div
                        className="stat-number"
                        style={{
                          color: getRatingColor(Number(month.average.toFixed(2)))
                        }}
                      >
                        {month.average.toFixed(2)} ★
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="quick-stats" style={{ marginTop: "12px" }}>
                <div className="quick-stat">
                  <span className="label">{t("workerHome.overallRating")}</span>
                  <span
                    className="value"
                    style={{ color: getRatingColor(Number(dashboard.avgRating)) }}
                  >
                    {dashboard.avgRating}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="no-data">{t("workerHome.noMonthlyHistory")}</p>
          )
        )}
      </div>
    </div>
  );
}

export default WorkerHome;