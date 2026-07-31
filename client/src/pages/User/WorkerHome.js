import { useState, useEffect, useMemo, useCallback } from "react";
import { supervisorService } from "../../services/api";
import { getRatingColor } from "../../utils/helpers";
import "../../styles/User/WorkerDashboard.css";
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

function WorkerHome({ worker }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [ratingData, setRatingData] = useState([]);
  const [showLegend, setShowLegend] = useState(false);

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
        recentRatings: [],
        updatedInLastWeek: 0,
        lowestAreas: [],
        fieldAverages: {},
        monthlyHistory: []
      };
    }

    const ratings = [...ratingData];

    const avgRatingRaw =
      ratings.reduce((sum, r) => {
        const fieldValues = ratingFields.map((f) => Number(r[f.key]) || 0);
        const avg = fieldValues.reduce((a, b) => a + b, 0) / fieldValues.length;
        return sum + avg;
      }, 0) / ratings.length;

    const recentRatings = [...ratings]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8);

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

    const monthlyHistory = Object.entries(monthlyMap)
      .map(([monthKey, entries]) => {
        const monthAverage =
          entries.reduce((sum, r) => {
            const values = ratingFields.map((f) => Number(r[f.key]) || 0);
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            return sum + avg;
          }, 0) / entries.length;

        return {
          monthKey,
          monthLabel: /^\d{4}-\d{2}$/.test(monthKey)
            ? new Date(`${monthKey}-01`).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long"
              })
            : monthKey,
          count: entries.length,
          average: monthAverage
        };
      })
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    return {
      avgRating: avgRatingRaw.toFixed(2),
      totalRatings: ratings.length,
      recentRatings,
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
        <h1>{t("workerHome.title")}</h1>
        <p>
          {t("workerHome.welcomeBack")} <strong>{worker.name}</strong> 👋
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card success">
          <div className="stat-icon">⭐</div>
          <div className="stat-info">
            <h3>{t("workerHome.avgRating")}</h3>
            <p
              className="stat-number"
              style={{ color: getRatingColor(Number(dashboard.avgRating)) }}
            >
              {dashboard.avgRating}
            </p>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <h3>{t("workerHome.totalReviews")}</h3>
            <p className="stat-number">{dashboard.totalRatings}</p>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <h3>{t("workerHome.updated7Days")}</h3>
            <p className="stat-number">{dashboard.updatedInLastWeek}</p>
          </div>
        </div>
      </div>

      <div className="recent-section">
        <h2>{t("workerHome.recentRatings")}</h2>

        {dashboard.recentRatings.length > 0 ? (
          <div className="recent-list">
            {dashboard.recentRatings.map((rating, idx) => {
              const ratingAvg = (
                ratingFields.reduce(
                  (sum, f) => sum + (Number(rating[f.key]) || 0),
                  0
                ) / ratingFields.length
              ).toFixed(1);

              const lowestFields = [...ratingFields]
                .map((f) => ({ ...f, value: Number(rating[f.key]) || 0 }))
                .sort((a, b) => a.value - b.value)
                .slice(0, 3);

              const isSupervisor = rating.ratedBy?.role === "supervisor";
              const sourceLabel = isSupervisor
                ? t("workerHome.supervisor")
                : t("workerHome.peer");
              const raterName = isSupervisor
                ? rating.ratedBy?.name || t("workerHome.teamLead")
                : t("workerHome.anonymousColleague");

              return (
                <div key={`${rating._id}-${idx}`} className="recent-item">
                  <div className="recent-worker">
                    {isSupervisor && (
                      <div className="worker-avatar">
                        {(rating.ratedBy?.name || "S").charAt(0).toUpperCase()}
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

                  <div className="recent-rating">
                    <div className="rating-fields-small">
                      <span className="field-badge main">
                        AVG: {ratingAvg}
                      </span>
                      {lowestFields.map((f) => (
                        <span key={f.key} className="field-badge warning">
                          {t(`kpiShort.${f.key}`)}: {f.value}
                        </span>
                      ))}
                    </div>
                    <p className="recent-time">
                      {new Date(rating.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="no-data">{t("workerHome.noRatings")}</p>
        )}
      </div>

      <div className="quick-stats">
        <div className="quick-stat">
          <span className="label">{t("workerHome.totalRatings")}</span>
          <span className="value">{dashboard.totalRatings}</span>
        </div>

        <div className="quick-stat">
          <span className="label">{t("workerHome.updated7Days")}</span>
          <span className="value">{dashboard.updatedInLastWeek}</span>
        </div>

        {dashboard.lowestAreas.length > 0 && (
          <div className="quick-stat">
            <span className="label">{t("workerHome.needsAttention")}</span>
            <span className="value">
              {dashboard.lowestAreas.map((f) => t(`kpiShort.${f.key}`)).join(", ")}
            </span>
          </div>
        )}
      </div>

      <div className="legend-box">
        <div
          className="legend-header"
          onClick={() => setShowLegend((prev) => !prev)}
        >
          <span className="legend-title">{t("workerHome.legendTitle")}</span>
          <span className="legend-toggle">
            {showLegend
              ? `– ${t("workerHome.hide")}`
              : `+ ${t("workerHome.show")}`}
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
        <h2>{t("workerHome.monthlyHistory")}</h2>

        {dashboard.monthlyHistory.length > 0 ? (
          <>
            <div className="recent-list">
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
                        color: getRatingColor(
                          Number(month.average.toFixed(2))
                        )
                      }}
                    >
                      {month.average.toFixed(2)} {t("workerHome.avgShort")}
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
                  style={{
                    color: getRatingColor(Number(dashboard.avgRating))
                  }}
                >
                  {dashboard.avgRating}
                </span>
              </div>
            </div>
          </>
        ) : (
          <p className="no-data">{t("workerHome.noMonthlyHistory")}</p>
        )}
      </div>
    </div>
  );
}

export default WorkerHome;