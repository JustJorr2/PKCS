import { useState, useEffect, useCallback, useMemo } from "react";
import { supervisorService } from "../../services/api";
import { getRatingColor } from "../../utils/helpers";
import "../../styles/Supervisor/SupervisorPages.css";
import { useLanguage } from "../../context/LanguageContext";

const ratingFields = [
  { key: "workAreaCompliance" },
  { key: "taskCompletion" },
  { key: "cleanliness" },
  { key: "wasteManagement" },
  { key: "organization" },
  { key: "uniformCompliance" },
  { key: "independence" },
  { key: "initiative" },
  { key: "teamworkSupport" },
  { key: "punctuality" },
  { key: "attendance" }
];

const PIE_SEGMENTS = [
  { key: "excellent", labelKey: "supervisorVisuals.excellentLabel", color: "#4caf50" },
  { key: "good", labelKey: "supervisorVisuals.goodLabel", color: "#2196f3" },
  { key: "average", labelKey: "supervisorVisuals.averageLabel", color: "#ff9800" },
  { key: "poor", labelKey: "supervisorVisuals.poorLabel", color: "#f44336" },
  { key: "notRated", labelKey: "supervisorVisuals.notRatedLabel", color: "#9e9e9e" }
];

// Generate list of quarter periods for the last 2 years
function generateQuarterOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 8; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - (i * 3), 1);
    const year = date.getFullYear();
    const quarterMonth = Math.floor(date.getMonth() / 3) * 3;
    const startMonth = quarterMonth;
    const months = [
      `${year}-${String(startMonth + 1).padStart(2, "0")}`,
      `${year}-${String(startMonth + 2).padStart(2, "0")}`,
      `${year}-${String(startMonth + 3).padStart(2, "0")}`
    ];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const label = `${monthNames[startMonth]}-${monthNames[startMonth + 2]} ${year}`;
    const key = months.join(",");
    // Avoid duplicates
    if (!options.find((o) => o.key === key)) {
      options.push({ label, key, months });
    }
  }
  return options;
}

// Generate the last N months as {key, label} options, most recent first.
function generateMonthChecklistOptions(count = 24) {
  const options = [];
  const now = new Date();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = 0; i < count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    options.push({ key, label: `${monthNames[month]} ${year}` });
  }
  return options;
}

function SupervisorDataVisuals({ worker }) {
  const { t } = useLanguage();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    avgRating: 0,
    topRated: [],
    ratingDistribution: { excellent: 0, good: 0, average: 0, poor: 0, notRated: 0 }
  });

  const [filterMode, setFilterMode] = useState("month"); // "month" | "quarter" | "checklist"
  const [filterMonth, setFilterMonth] = useState("");
  const [filterQuarter, setFilterQuarter] = useState("");
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [activeFilter, setActiveFilter] = useState("");

  const quarterOptions = useMemo(() => generateQuarterOptions(), []);
  const checklistOptions = useMemo(() => generateMonthChecklistOptions(), []);

  const computeStats = useCallback((data, useMonthlyAvg = false) => {
    if (data.length === 0) {
      setStats({
        avgRating: 0,
        topRated: [],
        ratingDistribution: { excellent: 0, good: 0, average: 0, poor: 0, notRated: 0 }
      });
      return;
    }

    // For quarter/checklist mode, use monthAverageRating; for all-time use averageRating
    const getScore = (w) => useMonthlyAvg
      ? (typeof w.monthAverageRating === "number" ? w.monthAverageRating : null)
      : Number(w.averageRating || 0);

    const scoredWorkers = data.map((w) => ({ ...w, _score: getScore(w) }));

    const ratedInPeriod = scoredWorkers.filter((w) => w._score !== null);
    const avgRating = ratedInPeriod.length > 0
      ? (ratedInPeriod.reduce((sum, w) => sum + w._score, 0) / ratedInPeriod.length).toFixed(2)
      : "0.00";

    const topRated = [...ratedInPeriod]
      .sort((a, b) => b._score - a._score)
      .slice(0, 6);

    const distribution = { excellent: 0, good: 0, average: 0, poor: 0, notRated: 0 };
    scoredWorkers.forEach((w) => {
      if (w._score === null || (!useMonthlyAvg && (!w.totalRatings || w.totalRatings === 0))) {
        distribution.notRated += 1;
      } else {
        if (w._score >= 3.51)
            distribution.excellent++;
        else if (w._score >= 2.76)
            distribution.good++;
        else if (w._score >= 2.00)
            distribution.average++;
        else
            distribution.poor++;
      }
    });

    setStats({ avgRating, topRated, ratingDistribution: distribution });
  }, []);

   const fetchSingleMonth = useCallback(async (month = "") => {
      try {
        setLoading(true);
        const response = await supervisorService.getDashboard(month || undefined, worker?._id);
        const data = response.data || [];
        setWorkers(data);
        computeStats(data, Boolean(month));
      } catch (err) {
        console.error("Error fetching chart data:", err);
      } finally {
        setLoading(false);
      }
    }, [computeStats, worker?._id]);

  // Used for both "quarter" mode and "checklist" mode — works on any length
  // array of month keys, merging by the highest monthAverageRating found
  // for each worker across the given months.
  const fetchMonthGroup = useCallback(async (months) => {
    try {
      setLoading(true);
      const responses = await Promise.all(
        months.map((m) => supervisorService.getDashboard(m, worker?._id))
      );

      // Build a map of workerId -> worker with best monthAverageRating across the months
      const workerMap = new Map();

      responses.forEach((res) => {
        const monthData = res.data || [];
        monthData.forEach((w) => {
          if (!workerMap.has(w._id)) {
            workerMap.set(w._id, { ...w });
          } else {
            const existing = workerMap.get(w._id);
            // If this month has a rating and existing doesn't, or this one is higher, use it
            if (
              typeof w.monthAverageRating === "number" &&
              (
                typeof existing.monthAverageRating !== "number" ||
                w.monthAverageRating > existing.monthAverageRating
              )
            ) {
              existing.monthAverageRating = w.monthAverageRating;
              existing.latestRating = w.latestRating;
            }
          }
        });
      });

      const mergedData = Array.from(workerMap.values());
      setWorkers(mergedData);
      // Always use monthAverageRating for grouped modes
      computeStats(mergedData, true);
      } catch (err) {
      console.error("Error fetching grouped month data:", err);
      } finally {
        setLoading(false);
      }
    }, [computeStats, worker?._id]);

  useEffect(() => {
    fetchSingleMonth();
  }, [fetchSingleMonth]);

  const toggleMonthChecked = (key) => {
    setSelectedMonths((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
    );
  };

  const handleApplyFilter = () => {
    if (filterMode === "month") {
      fetchSingleMonth(filterMonth);
      setActiveFilter(filterMonth ? `Month: ${filterMonth}` : "");
    } else if (filterMode === "quarter") {
      const quarter = quarterOptions.find((q) => q.key === filterQuarter);
      if (quarter) {
        fetchMonthGroup(quarter.months);
        setActiveFilter(`Quarter: ${quarter.label}`);
      }
    } else if (filterMode === "checklist") {
      if (selectedMonths.length === 0) {
        alert(t("supervisorVisuals.noMonthsSelected"));
        return;
      }
      fetchMonthGroup(selectedMonths);
      setActiveFilter(
        selectedMonths.length <= 3
          ? selectedMonths.join(", ")
          : `${selectedMonths.length} ${t("supervisorVisuals.monthsSelected")}`
      );
    }
  };

  const handleResetFilter = () => {
    setFilterMonth("");
    setFilterQuarter("");
    setSelectedMonths([]);
    setActiveFilter("");
    fetchSingleMonth("");
  };

  const ratedWorkers = useMemo(
    () => workers.filter((w) => w.latestRating),
    [workers]
  );

  const totalWorkers = workers.length;
  const getBarWidth = (count) => (totalWorkers > 0 ? (count / totalWorkers) * 100 : 0);

  const getKpiAverage = (key) => {
    const kpiValues = ratedWorkers
      .map((w) => w.latestRating?.[key])
      .filter((v) => typeof v === "number");
    if (kpiValues.length === 0) return 0;
    return kpiValues.reduce((sum, v) => sum + v, 0) / kpiValues.length;
  };

  const pieData = useMemo(() => {
    const total = PIE_SEGMENTS.reduce(
      (sum, segment) => sum + (stats.ratingDistribution[segment.key] || 0),
      0
    );

    if (!total) {
      return {
        background: "#e5e7eb",
        total: 0,
        legend: PIE_SEGMENTS.map((segment) => ({ ...segment, count: 0, percent: 0 }))
      };
    }

    let cumulative = 0;
    const colorStops = [];

    const legend = PIE_SEGMENTS.map((segment) => {
      const count = stats.ratingDistribution[segment.key] || 0;
      const percent = (count / total) * 100;
      const start = cumulative;
      const end = cumulative + percent;
      colorStops.push(`${segment.color} ${start}% ${end}%`);
      cumulative = end;
      return { ...segment, count, percent };
    });

    return {
      background: `conic-gradient(${colorStops.join(", ")})`,
      total,
      legend
    };
  }, [stats.ratingDistribution]);

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading">{t("supervisorVisuals.loading")}</div>
      </div>
    );
  }

  return (
    <div className="page-content supervisor-visuals">
      <div className="page-header">
        <h1>{t("supervisorVisuals.title")}</h1>
        <p>{t("supervisorVisuals.subtitle")}</p>
      </div>

      {/* Filter Bar */}
      <div className="dv-filter-bar">
        <div className="dv-filter-inputs">
          {/* Mode toggle */}
          <div className="dv-filter-group">
            <label>{t("supervisorVisuals.filterBy")}</label>
            <select
              className="sort-select"
              value={filterMode}
              onChange={(e) => {
                setFilterMode(e.target.value);
                setFilterMonth("");
                setFilterQuarter("");
                setSelectedMonths([]);
              }}
            >
              <option value="month">{t("supervisorVisuals.byDate")}</option>
              <option value="quarter">{t("supervisorVisuals.byQuarter")}</option>
              <option value="checklist">{t("supervisorVisuals.byChecklist")}</option>
            </select>
          </div>

          {/* Month picker */}
          {filterMode === "month" && (
            <div className="dv-filter-group">
              <label>{t("supervisorVisuals.byMonth")}</label>
              <input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
              />
            </div>
          )}

          {/* Quarter picker */}
          {filterMode === "quarter" && (
            <div className="dv-filter-group">
              <option value="quarter">{t("supervisorVisuals.byQuarter")}</option>
              <select
                className="sort-select"
                value={filterQuarter}
                onChange={(e) => setFilterQuarter(e.target.value)}
              >
                <option value="">{t("supervisorVisuals.selectQuarter")}</option>
                {quarterOptions.map((q) => (
                  <option key={q.key} value={q.key}>{q.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Checklist picker */}
          {filterMode === "checklist" && (
            <div className="dv-filter-group dv-checklist-group">
              <label>{t("supervisorVisuals.selectMonths")}</label>
              <div className="dv-month-checklist">
                {checklistOptions.map((opt) => (
                  <label key={opt.key} className="dv-month-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedMonths.includes(opt.key)}
                      onChange={() => toggleMonthChecked(opt.key)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <button className="dv-btn-apply" onClick={handleApplyFilter}>
            {t("supervisorVisuals.apply")}
          </button>
          {activeFilter && (
            <button className="dv-btn-reset" onClick={handleResetFilter}>
              x {activeFilter}
            </button>
          )}
        </div>
        {activeFilter && (
          <p className="dv-filter-note">
            {t("supervisorVisuals.filterNote")}
          </p>
        )}
      </div>

      {/* Summary Cards */}
      <div className="visuals-summary">
        <div className="summary-card">
          <h3>{t("supervisorVisuals.overallAverage")}</h3>
          <div className="big-stat">{stats.avgRating}</div>
          <p className="summary-note">
            {t("supervisorVisuals.basedOnWorkers").replace("{count}", String(totalWorkers))}
          </p>
        </div>
        <div className="summary-card">
          <h3>{t("supervisorVisuals.totalWorkersEvaluated")}</h3>
          <div className="big-stat">{totalWorkers}</div>
          <p className="summary-note">{t("supervisorVisuals.activeInSystem")}</p>
        </div>
        <div className="summary-card">
          <h3>{t("supervisorVisuals.excellentPerformers")}</h3>
          <div className="big-stat">{stats.ratingDistribution.excellent}</div>
          <p className="summary-note">{t("supervisorVisuals.ratingThreeFour")}</p>
        </div>
        <div className="summary-card">
          <h3>{t("supervisorVisuals.notRatedSummary")}</h3>
          <div className="big-stat" style={{ color: "#9e9e9e" }}>
            {stats.ratingDistribution.notRated}
          </div>
          <p className="summary-note">{t("supervisorVisuals.notRatedNote")}</p>
        </div>
      </div>

      {totalWorkers === 0 ? (
        <div className="no-data">{t("supervisorVisuals.noDataFilter")}</div>
      ) : (
        <>
          {/* Rating Distribution Bar */}
          <div className="chart-section">
            <h2>{t("supervisorVisuals.ratingDistribution")}</h2>
            <div className="distribution-container">
              {PIE_SEGMENTS.map((item) => (
                <div key={item.key} className="distribution-bar">
                  <div className="bar-label">
                    <span>
                      {item.key === "notRated" ? t("supervisorVisuals.notRatedLabel") : t(item.labelKey)}
                    </span>
                    <span>{stats.ratingDistribution[item.key] || 0}</span>
                  </div>
                  <div className="bar-background">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${getBarWidth(stats.ratingDistribution[item.key] || 0)}%`,
                        backgroundColor: item.color
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pie Chart */}
          <div className="chart-section">
            <h2>{t("supervisorVisuals.pieTitle")}</h2>
            <div className="pie-chart-layout">
              <div className="pie-chart" style={{ background: pieData.background }}>
                <div className="pie-center">
                  <span>{pieData.total}</span>
                  <small>{t("supervisorVisuals.workers")}</small>
                </div>
              </div>
              <div className="pie-legend">
                {pieData.legend.map((item) => (
                  <div key={item.key} className="pie-legend-item">
                    <span className="pie-dot" style={{ backgroundColor: item.color }} />
                    <span className="pie-label">
                      {item.key === "notRated" ? t("supervisorVisuals.notRatedLabel") : t(item.labelKey)}
                    </span>
                    <span className="pie-value">
                      {item.count} ({item.percent.toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Performers */}
          <div className="chart-section">
            <h2>{t("supervisorVisuals.topPerformers")}</h2>
            <div className="top-performers">
              {stats.topRated.map((worker, index) => (
                <div key={worker._id} className="performer-item">
                  <div className="performer-info">
                    <h4>#{index + 1}</h4>
                    <p className="performer-name">{worker.name}</p>
                    <p className="performer-email">{worker.email}</p>
                  </div>
                  <div className="performer-rating">
                    <span
                      className="rating-badge-large"
                      style={{ backgroundColor: getRatingColor(worker.averageRating) }}
                    >
                      {Number(worker.averageRating).toFixed(1)}
                    </span>
                  </div>
                  <div className="performer-meta">
                    <p>{worker.totalRatings} {t("supervisorVisuals.ratings")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* KPI Averages */}
          <div className="chart-section">
            <h2>{t("supervisorVisuals.kpiAverages")}</h2>
            <p className="kpi-note">
              {t("supervisorVisuals.kpiNote").replace("{count}", String(ratedWorkers.length))}
            </p>
            <div className="skills-overview">
              {ratingFields.map((field) => {
                const avg = getKpiAverage(field.key);
                return (
                  <div className="skill-item" key={field.key}>
                    <span className="skill-name">{t(`kpi.${field.key}`)}</span>
                    <div className="skill-bar">
                      <div
                        className="skill-fill"
                        style={{ width: `${(avg / 4) * 100}%` }}
                      />
                    </div>
                    <span className="skill-value">{avg.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default SupervisorDataVisuals;