import { useState, useEffect, useMemo, useCallback } from "react";
import { supervisorService } from "../../services/api";
import { getRatingColor } from "../../utils/helpers";
import "../../styles/Supervisor/SupervisorPages.css";
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

function getRecentMonthKeys(count = 6) {
  const keys = [];
  const now = new Date();

  for (let i = 1; i <= count; i++) {
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
        month: "long",
      })
    : monthKey;
}

function SupervisorHome({ worker }) {
  const { t } = useLanguage();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [monthlyRatings, setMonthlyRatings] = useState([]);
  const [expandedMonths, setExpandedMonths] = useState({});



 const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const monthKeys = getRecentMonthKeys(6);

      const responses = await Promise.all(
        monthKeys.map((monthKey) =>
          supervisorService.getDashboard(monthKey, worker?._id)
        )
      );

      // Keep the previous/latest month for the existing dashboard statistics
      setWorkers(responses[0]?.data || []);

      // Build monthly rating data
      const monthlyData = responses.map((response, index) => ({
        monthKey: monthKeys[index],
        workers: response.data || [],
      }));

      setMonthlyRatings(monthlyData);
    } catch (err) {
      console.error("Error fetching home data:", err);
      setWorkers([]);
      setMonthlyRatings([]);
    } finally {
      setLoading(false);
    }
  }, [worker?._id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const dashboard = useMemo(() => {
    if (!workers.length) {
      return {
        totalWorkers: 0,
        avgRating: "0.00",
        ratedWorkers: 0,
        unratedWorkers: 0,
        topWorker: null,
        supportWorker: null,
        recentRatings: [],
        updatedInLastWeek: 0,
        supportCount: 0
      };
    }

    const ratedWorkersList = workers.filter((w) => (w.totalRatings || 0) > 0);
    const unratedWorkers = workers.length - ratedWorkersList.length;

    const avgRatingRaw =
      workers.reduce((sum, w) => sum + (Number(w.averageRating) || 0), 0) / workers.length;

    const sortedRated = [...ratedWorkersList].sort(
      (a, b) => (Number(b.averageRating) || 0) - (Number(a.averageRating) || 0)
    );

    const topWorker = sortedRated[0] || null;
    const supportWorker = sortedRated.length ? sortedRated[sortedRated.length - 1] : null;

    const recentRatings = workers
      .filter((w) => w.latestRating)
      .sort((a, b) => new Date(b.latestRating.createdAt) - new Date(a.latestRating.createdAt))
      .slice(0, 8)
      .map((w) => ({ worker: w, rating: w.latestRating }));

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    const updatedInLastWeek = workers.filter((w) => {
      if (!w.latestRating?.createdAt) return false;
      const created = new Date(w.latestRating.createdAt).getTime();
      return now - created <= sevenDaysMs;
    }).length;

    const supportCount = ratedWorkersList.filter((w) => (Number(w.averageRating) || 0) < 3).length;

    const ratingsByMonth = monthlyRatings
    .map(({ monthKey, workers: monthWorkers }) => {
      const entries = monthWorkers
        .filter((w) => w.latestRating)
        .sort(
          (a, b) =>
            new Date(b.latestRating.createdAt) -
            new Date(a.latestRating.createdAt)
        )
        .map((w) => ({
          worker: w,
          rating: w.latestRating,
        }));

      return {
        monthKey,
        monthLabel: monthLabelFor(monthKey),
        entries,
      };
    })
    .filter((month) => month.entries.length > 0);

    return {
      totalWorkers: workers.length,
      avgRating: avgRatingRaw.toFixed(2),
      ratedWorkers: ratedWorkersList.length,
      unratedWorkers,
      topWorker,
      supportWorker,
      recentRatings,
      updatedInLastWeek,
      supportCount,
      ratingsByMonth
    };
  }, [workers, monthlyRatings]);

  const toggleMonth = (monthKey) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [monthKey]: !prev[monthKey],
    }));
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading">{t("supervisorHome.loading")}</div>
      </div>
    );
  }

  return (
    <div className="page-content supervisor-home">
      <div className="page-header">
        <h1>{t("supervisorHome.welcomeBack")}</h1>
        <p>{t("supervisorHome.overview")}</p>
      </div>

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
            <p className="stat-text">{dashboard.topWorker?.name || t("supervisorHome.notAvailable")}</p>
            {dashboard.topWorker && (
              <p className="stat-meta">{Number(dashboard.topWorker.averageRating).toFixed(1)} ★</p>
            )}
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">📉</div>
          <div className="stat-info">
            <h3>{t("supervisorHome.supportNeeded")}</h3>
            <p className="stat-text">{dashboard.supportWorker?.name || t("supervisorHome.notAvailable")}</p>
            {dashboard.supportWorker && (
              <p className="stat-meta">{Number(dashboard.supportWorker.averageRating).toFixed(1)} ★</p>
            )}
          </div>
        </div>
      </div>

      <div className="recent-section">
        <h2>{t("supervisorHome.recentRatings")}</h2>

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
                      {month.entries.map((item, idx) => {
                        const ratingAvg = (
                          ratingFields.reduce(
                            (sum, f) =>
                              sum + (Number(item.rating[f.key]) || 0),
                            0
                          ) / ratingFields.length
                        ).toFixed(1);

                        const lowestFields = [...ratingFields]
                          .map((f) => ({
                            ...f,
                            value: Number(item.rating[f.key]) || 0,
                          }))
                          .sort((a, b) => a.value - b.value)
                          .slice(0, 3);

                        return (
                          <div
                            key={`${item.worker._id}-${item.rating.createdAt}-${idx}`}
                            className="recent-item"
                          >
                            <div className="recent-worker">
                              <div className="worker-avatar">
                                {item.worker.name
                                  ?.charAt(0)
                                  .toUpperCase()}
                              </div>

                              <div className="worker-details">
                                <h4>{item.worker.name}</h4>
                                <p className="worker-email">
                                  {item.worker.email}
                                </p>
                              </div>
                            </div>

                            <div className="recent-rating">
                              <div className="rating-fields-small">
                                <span className="field-badge main">
                                  AVG: {ratingAvg} ★
                                </span>

                                {lowestFields.map((f) => (
                                  <span
                                    key={f.key}
                                    className="field-badge warning"
                                  >
                                    {t(`kpiShort.${f.key}`)}: {f.value} ★
                                  </span>
                                ))}
                              </div>

                              <p className="recent-time">
                                {new Date(
                                  item.rating.createdAt
                                ).toLocaleDateString()}
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
          <p className="no-data">
            {t("supervisorHome.noRatings")}
          </p>
        )}
      </div>

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
          <span className="value">{dashboard.supportCount}</span>
        </div>
      </div>

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