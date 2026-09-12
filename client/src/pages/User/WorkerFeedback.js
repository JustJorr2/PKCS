import { useEffect, useState, useCallback } from "react";
import { ratingsService } from "../../services/api";
import { getRatingColor } from "../../utils/helpers";
import "../../styles/User/WorkerDashboard.css";
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
  { key: "attendance", short: "AT" }
];

// Same thresholds/colors as WorkerRatings, minus "No ratings yet" —
// every card here is an actual submitted rating, so 0 is a real score, not "unrated"
const RATING_COLOR_LEGEND = [
  { color: "#27ae60", key: "excellent", fallback: "Excellent (≥ 3.51)" },
  { color: "#2f80ed", key: "good", fallback: "Good (2.76 – 3.50)" },
  { color: "#f39c12", key: "average", fallback: "Average (2.00 – 2.75)" },
  { color: "#e74c3c", key: "needsImprovement", fallback: "Needs Improvement (< 2.00)" }
];

function formatRating(value, language) {
  if (value === null || value === undefined || isNaN(value)) return "-";
  const formatted = Number(value).toFixed(2);
  return language === "id" ? formatted.replace(".", ",") : formatted;
}

function getPreviousMonthKey() {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey;
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long"
  });
}

function WorkerFeedback({ worker }) {
  const { t, language } = useLanguage();
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(getPreviousMonthKey());
  const [selectedMonth, setSelectedMonth] = useState(getPreviousMonthKey());
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);

  const fetchFeedback = useCallback(async (month = selectedMonth) => {
    try {
      setLoading(true);

      const res = await ratingsService.getRatingsForUser(worker._id, {
        ...(month && { month })
      });

      setRatings(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching feedback:", err);
    } finally {
      setLoading(false);
    }
  }, [worker._id, selectedMonth]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const handleApplyFilter = () => {
    setSelectedMonth(filterMonth);
    setShowPeriodPicker(false);
  };

  const handleResetFilter = () => {
    const previous = getPreviousMonthKey();
    setFilterMonth(previous);
    setSelectedMonth(previous);
    setShowPeriodPicker(false);
  };

  const calculateAverage = (rating) => {
    const values = ratingFields.map((f) => Number(rating[f.key]) || 0);
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  const supervisorFeedback = ratings.filter((r) => r.ratedBy?.role === "supervisor");
  const peerFeedback = ratings.filter((r) => r.ratedBy?.role !== "supervisor");

  const renderCard = (item) => {
    const avg = calculateAverage(item);
    const isFromSupervisor = item.ratedBy?.role === "supervisor";
    const raterName = isFromSupervisor ? item.ratedBy?.name : t("workerFeedback.anonymousColleague");

    return (
      <div className="feedback-card">
        <div className="feedback-header">
          <div className="feedback-left">
            <div className="supervisor-badge">
              {isFromSupervisor ? t("workerFeedback.supervisorLabel") : t("workerFeedback.peerLabel")}
            </div>
            <span className="rater-name">{raterName}</span>
            <span className="feedback-date">
              {new Date(item.createdAt).toLocaleDateString()}
            </span>
          </div>
          <span
            className="rating-badge feedback-average-badge"
            style={{ backgroundColor: getRatingColor(avg) }}
          >
            {formatRating(avg, language)} ★
          </span>
        </div>

        <div className="feedback-ratings">
          {ratingFields.map((f) => {
            const value = Number(item[f.key]) || 0;
            return (
              <div key={f.key} className="field-badge">
                <span className="field-badge-label">{t(`kpiShort.${f.key}`)}</span>
                <span
                  className="field-badge-value"
                  style={{ color: getRatingColor(value) }}
                >
                  {formatRating(value, language)}
                </span>
              </div>
            );
          })}
        </div>

        {item.comment && (
          <div className="feedback-comment">
            {item.comment}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page-content worker-dashboard">
      <div className="page-header supervisor-ratings-header">
        <div>
          <h1>{t("workerFeedback.title")}</h1>
          <p>{t("workerFeedback.subtitle")}</p>
        </div>

        <div className="period-filter-wrap">
          <div
            className="period-filter-card"
            onClick={() => setShowPeriodPicker((prev) => !prev)}
          >
            <span className="period-icon">📅</span>
            <div className="period-info">
              <span className="period-label">{t("workerFeedback.ratingMonth")}</span>
              <span className="period-value">{formatMonthLabel(selectedMonth)}</span>
            </div>
            <span className="period-toggle">{showPeriodPicker ? "▲" : "▼"}</span>
          </div>

          {showPeriodPicker && (
            <div className="period-picker-dropdown">
              <div className="wf-filter-group">
                <label>{t("workerFeedback.byMonth")}</label>
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                />
              </div>
              <button className="wf-btn-apply" onClick={handleApplyFilter}>
                {t("workerFeedback.apply")}
              </button>
              {selectedMonth !== getPreviousMonthKey() && (
                <button className="wf-btn-reset" onClick={handleResetFilter}>
                  x {formatMonthLabel(selectedMonth)}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

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
          {t("workerFeedback.legendTitle")}
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
        <div className="loading">{t("workerFeedback.loadingFeedback")}</div>
      ) : (
        <>
          <div className="recent-section">
            <h2>{t("workerFeedback.supervisorFeedback")}</h2>
            {supervisorFeedback.length === 0 ? (
              <div className="no-data">{t("workerFeedback.noSupervisorFeedback")}</div>
            ) : (
              <div className="feedback-list">
                {supervisorFeedback.map((item, i) => (
                  <div key={i}>{renderCard(item)}</div>
                ))}
              </div>
            )}
          </div>

          <div className="recent-section">
            <h2>{t("workerFeedback.peerFeedback")}</h2>
            {peerFeedback.length === 0 ? (
              <div className="no-data">{t("workerFeedback.noPeerFeedback")}</div>
            ) : (
              <div className="feedback-list">
                {peerFeedback.map((item, i) => (
                  <div key={i}>{renderCard(item)}</div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default WorkerFeedback;