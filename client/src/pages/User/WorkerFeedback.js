import { useEffect, useState, useCallback } from "react";
import { ratingsService } from "../../services/api";
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
  { key: "attendance", short: "AT" }
];

function WorkerFeedback({ worker }) {
  const { t } = useLanguage();
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  const fetchFeedback = useCallback(async (month = filterMonth) => {
    try {
      setLoading(true);

      const res = await ratingsService.getRatingsForUser(worker._id, {
        ...(month && { month })
      });

      const withComments = (Array.isArray(res.data) ? res.data : []).filter(
        (r) => r.comment
      );

      setRatings(withComments);
    } catch (err) {
      console.error("Error fetching feedback:", err);
    } finally {
      setLoading(false);
    }
  }, [worker._id, filterMonth]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const handleApplyFilter = () => {
    fetchFeedback(filterMonth);
    if (filterMonth) setActiveFilter(`Month: ${filterMonth}`);
  };

  const handleResetFilter = () => {
    setFilterMonth("");
    setActiveFilter("");
    fetchFeedback("");
  };

  const calculateAverage = (rating) => {
    const values = ratingFields.map((f) => Number(rating[f.key]) || 0);
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
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
          <div
            className="feedback-average"
            style={{ color: getRatingColor(Number(avg)) }}
          >
            * {avg}
          </div>
        </div>

        <div className="feedback-ratings">
          {ratingFields.map((f) => (
            <span key={f.key} className="field-badge" title={t(`kpi.${f.key}`)}>
              {t(`kpiShort.${f.key}`)}: {item[f.key] ?? 0}*
            </span>
          ))}
        </div>

        <div className="feedback-comment">
          {item.comment}
        </div>
      </div>
    );
  };

  return (
    <div className="page-content worker-dashboard">
      <div className="page-header">
        <h1>{t("workerFeedback.title")}</h1>
        <p>{t("workerFeedback.subtitle")}</p>
      </div>

      <div className="wf-filter-bar">
        <div className="wf-filter-inputs">
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
          {activeFilter && (
            <button className="wf-btn-reset" onClick={handleResetFilter}>
              x {activeFilter}
            </button>
          )}
        </div>
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

