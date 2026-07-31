import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supervisorService } from "../../services/api";
import { getRatingColor, getRatingStatus } from "../../utils/helpers";
import "../../styles/common/WorkerInformation.css";

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
  { key: "attendance", label: "Attendance", short: "AT" }
];

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

  const [worker, setWorker] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState(new Set());

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

  if (loading) return (
    <div className="wi-loading-screen">
      <div className="wi-spinner" />
      <p>Loading worker profile…</p>
    </div>
  );

  if (!worker) return (
    <div className="wi-error-screen">
      <span className="wi-error-icon">⚠️</span>
      <p>Worker not found</p>
      <button className="wi-back-btn" onClick={() => navigate(-1)}>← Go back</button>
    </div>
  );

  const avgRating = worker.averageRating;
  const hasRatings = worker.totalRatings > 0;

  return (
    <div className="worker-info-page">

      {/* BREADCRUMB / BACK */}
      <nav className="wi-breadcrumb">
        <button className="wi-back-btn" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <span className="wi-crumb-sep">/</span>
        <span className="wi-crumb-inactive">Workers</span>
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
              {getRatingStatus(avgRating)}
            </div>
          )}
        </div>
        {hasRatings && (
          <div className="wi-hero-score" style={{ borderColor: getRatingColor(avgRating) }}>
            <span className="wi-score-num" style={{ color: getRatingColor(avgRating) }}>
              {avgRating.toFixed(1)}
            </span>
            <span className="wi-score-star">★</span>
            <span className="wi-score-label">avg</span>
          </div>
        )}
      </div>

      {/* STATS ROW */}
      <div className="wi-stats">
        <div className="wi-stat-card">
          <div className="wi-stat-icon">📋</div>
          <div>
            <div className="wi-stat-value">{worker.totalRatings}</div>
            <div className="wi-stat-label">Total Sessions</div>
          </div>
        </div>
        <div className="wi-stat-card">
          <div className="wi-stat-icon">⭐</div>
          <div>
            <div className="wi-stat-value" style={{ color: hasRatings ? getRatingColor(avgRating) : undefined }}>
              {hasRatings ? avgRating.toFixed(1) : "—"}
            </div>
            <div className="wi-stat-label">Average Score</div>
          </div>
        </div>
        <div className="wi-stat-card">
          <div className="wi-stat-icon">🏷️</div>
          <div>
            <div className="wi-stat-value wi-stat-status">{getRatingStatus(avgRating)}</div>
            <div className="wi-stat-label">Performance</div>
          </div>
        </div>
      </div>

      {/* RATING HISTORY */}
      <div className="wi-history">
        <div className="wi-history-header">
          <h2>Rating History</h2>
          {ratings.length > 0 && (
            <span className="wi-history-count">{ratings.length} month{ratings.length !== 1 ? "s" : ""}</span>
          )}
        </div>

        {ratings.length === 0 ? (
          <div className="wi-empty">
            <span className="wi-empty-icon">📭</span>
            <p>No ratings recorded yet.</p>
          </div>
        ) : (
          <div className="wi-cards">
            {ratings.map((r, i) => {
              const avg = KPI_FIELDS.reduce((sum, f) => sum + (r[f.key] || 0), 0) / KPI_FIELDS.length;
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
                      <span className="wi-card-index">#{ratings.length - i}</span>
                      <div className="wi-card-meta">
                        <span className="wi-card-date">
                          {monthLabel || new Date(r.createdAt).toLocaleDateString(undefined, {
                            year: "numeric", month: "short", day: "numeric"
                          })}
                        </span>
                        <span className="wi-card-ratedby">
                          {r.ratedBy?.role === "supervisor"
                            ? `Supervisor • ${r.ratedBy?.name || "Unknown"}`
                            : `Peer • ${r.ratedBy?.name || "Unknown"}`}
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
                        {KPI_FIELDS.map(f => {
                          const val = r[f.key] ?? 0;
                          return (
                            <div key={f.key} className="wi-kpi">
                              <span className="wi-kpi-short">{f.short}</span>
                              <span
                                className="wi-kpi-val"
                                style={{ color: getRatingColor(val) }}
                              >
                                {val}
                              </span>
                              <span className="wi-kpi-label">{f.label}</span>
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
