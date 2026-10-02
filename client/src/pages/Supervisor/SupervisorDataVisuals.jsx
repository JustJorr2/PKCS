import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supervisorService } from "../../services/api";
import { getRatingColor } from "../../utils/helpers";
import "../../styles/Supervisor/SupervisorPages.css";
import { useLanguage } from "../../context/LanguageContext";
import FeedbackDialog from "../../components/common/FeedbackDialog";
import { Users, UserX, Star, AlertTriangle } from "lucide-react";

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
  { key: "attendance" },
  { key: "leaveOnTime" }
];

const PIE_SEGMENTS = [
  { key: "excellent", labelKey: "supervisorVisuals.excellentLabel", color: "#4caf50" },
  { key: "good", labelKey: "supervisorVisuals.goodLabel", color: "#2196f3" },
  { key: "average", labelKey: "supervisorVisuals.averageLabel", color: "#ff9800" },
  { key: "poor", labelKey: "supervisorVisuals.poorLabel", color: "#f44336" },
  { key: "notRated", labelKey: "supervisorVisuals.notRatedLabel", color: "#9e9e9e" }
];

const WORKER_AREAS = ["Komperta", "Kantor", "Rudis GM", "CCR 1-4", "PLTP 5&6"];

// How many trailing months each independent trend-range option pulls in.
const TREND_RANGE_MONTHS = { monthly: 3, sixMonths: 6, yearly: 12 };

function formatMonthKey(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return monthKey;
  return new Date(`${monthKey}-01`).toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

/* =========================================================
   PERIOD OPTIONS
   ========================================================= */

function generateQuarterOptions() {
  const options = [];
  const now = new Date();

  for (let i = 0; i < 8; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
    const year = date.getFullYear();
    const quarterMonth = Math.floor(date.getMonth() / 3) * 3;
    const startMonth = quarterMonth;

    const months = [
      `${year}-${String(startMonth + 1).padStart(2, "0")}`,
      `${year}-${String(startMonth + 2).padStart(2, "0")}`,
      `${year}-${String(startMonth + 3).padStart(2, "0")}`
    ];

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const label = `${monthNames[startMonth]}-${monthNames[startMonth + 2]} ${year}`;
    const key = months.join(",");

    if (!options.find((o) => o.key === key)) {
      options.push({ label, key, months });
    }
  }

  return options;
}

function generateMonthChecklistOptions(count = 24) {
  const options = [];
  const now = new Date();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  for (let i = 0; i < count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;

    options.push({ key, label: `${monthNames[month]} ${year}` });
  }

  return options;
}

const LOW_RATING_THRESHOLD = 2.0; 

function buildStats(data, isPeriodScoped, minRaters, selectedMonthKeys = null) {
  const empty = {
    avgRating: "0.00",
    topRated: [],
    allRanked: [],
    ratedCount: 0,
    belowTwoWorkers: [],
    ratingDistribution: { excellent: 0, good: 0, average: 0, poor: 0, notRated: 0 }
  };

  if (!data || data.length === 0) return empty;

  const getScore = (w) =>
    isPeriodScoped
      ? (typeof w.monthAverageRating === "number" ? w.monthAverageRating : null)
      : (typeof w.cumulativeAverageRating === "number" ? w.cumulativeAverageRating : null);

  const getRatingsCount = (w) => (isPeriodScoped ? w.monthRatingsCount || 0 : w.cumulativeRatingsCount || 0);
  const getRaterIds = (w) => (isPeriodScoped ? w.monthRaterIds : w.cumulativeRaterIds) || [];

  const uniqueWorkers = Array.from(
    new Map(data.map((worker) => [String(worker._id), worker])).values()
  );

  const scoredWorkers = uniqueWorkers.map((w) => {
    const raterIds = getRaterIds(w);
    return {
      ...w,
      _score: getScore(w),
      _ratingsCount: getRatingsCount(w),
      _ratersCount: raterIds.length
    };
  });

  const ratedInPeriod = scoredWorkers.filter((w) => w._score !== null && w._ratingsCount > 0);

  const avgRating =
    ratedInPeriod.length > 0
      ? (ratedInPeriod.reduce((sum, w) => sum + w._score, 0) / ratedInPeriod.length).toFixed(2)
      : "0.00";

  // Calibration: a worker whose score comes from fewer raters than the
  // selected minimum is excluded from the ranking, so one favorable rater
  // can't outrank someone evaluated more broadly.
  const calibrated = ratedInPeriod.filter((w) => w._ratersCount >= minRaters);

  const allRanked = [...calibrated].sort((a, b) => b._score - a._score);
  const topRated = allRanked.slice(0, 6);

  // Below-2.0 workers:
  // - Period filter active (selectedMonthKeys set): workers whose average
  //   score IN THAT PERIOD is at/below the threshold.
  // - No filter (all time): workers who have EVER had a month at/below the
  //   threshold, using their full lowRatingHistory from the backend.
  let belowTwoWorkers;

  if (selectedMonthKeys) {
    belowTwoWorkers = ratedInPeriod
      .filter((w) => w._score < LOW_RATING_THRESHOLD)
      .map((w) => ({
        ...w,
        _lowRatingHistory: [{
          dateKey: Array.from(selectedMonthKeys).join(", "),
          average: w._score,
          createdAt: w.latestRating?.createdAt
        }]
      }))
      .sort((a, b) => a._score - b._score);
  } else {
    belowTwoWorkers = ratedInPeriod
      .map((w) => {
        const historyByMonth = new Map();
        (w.lowRatingHistory || []).forEach((entry) => historyByMonth.set(entry.dateKey, entry));

        const history = Array.from(historyByMonth.values()).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        return { ...w, _lowRatingHistory: history };
      })
      .filter((w) => w._lowRatingHistory.length > 0)
      .sort((a, b) => {
        if (b._lowRatingHistory.length !== a._lowRatingHistory.length) {
          return b._lowRatingHistory.length - a._lowRatingHistory.length;
        }
        return Math.min(...a._lowRatingHistory.map((e) => e.average)) -
          Math.min(...b._lowRatingHistory.map((e) => e.average));
      });
  }

  const distribution = { excellent: 0, good: 0, average: 0, poor: 0, notRated: 0 };

  scoredWorkers.forEach((w) => {
    if (w._score === null || w._ratingsCount === 0) {
      distribution.notRated += 1;
    } else if (w._score >= 3.51) {
      distribution.excellent++;
    } else if (w._score >= 2.76) {
      distribution.good++;
    } else if (w._score >= 2.0) {
      distribution.average++;
    } else {
      distribution.poor++;
    }
  });

  return { avgRating, topRated, allRanked, ratedCount: ratedInPeriod.length, belowTwoWorkers, ratingDistribution: distribution };
}

/* =========================================================
   AREA BREAKDOWN
   ========================================================= */

function buildAreaStats(data, isPeriodScoped) {
  const getScore = (w) =>
    isPeriodScoped
      ? (typeof w.monthAverageRating === "number" ? w.monthAverageRating : null)
      : (typeof w.cumulativeAverageRating === "number" ? w.cumulativeAverageRating : null);

  const getRatingsCount = (w) => (isPeriodScoped ? w.monthRatingsCount || 0 : w.cumulativeRatingsCount || 0);

  const areaMap = new Map();

  (data || []).forEach((w) => {
    const areaKey = w.area || "unassigned";
    const score = getScore(w);
    const ratingsCount = getRatingsCount(w);

    if (!areaMap.has(areaKey)) {
      areaMap.set(areaKey, { area: areaKey, totalScore: 0, ratedCount: 0, totalWorkers: 0, totalRatings: 0 });
    }

    const entry = areaMap.get(areaKey);
    entry.totalWorkers += 1;

    if (score !== null && ratingsCount > 0) {
      entry.totalScore += score;
      entry.ratedCount += 1;
      entry.totalRatings += ratingsCount;
    }
  });

  return Array.from(areaMap.values())
    .map((entry) => ({
      area: entry.area,
      avg: entry.ratedCount > 0 ? entry.totalScore / entry.ratedCount : 0,
      ratedCount: entry.ratedCount,
      totalWorkers: entry.totalWorkers,
      totalRatings: entry.totalRatings
    }))
    .sort((a, b) => b.avg - a.avg);
}

/* =========================================================
   TREND CHART
   ========================================================= */

function TrendMiniChart({ data, emptyLabel }) {
  const width = 420;
  const height = 230;
  const padding = 36;

  if (!data || data.length === 0) {
    return <div className="no-data trend-empty">{emptyLabel}</div>;
  }

  const max = 4;
  const min = 0;
  const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
  const scaleY = (val) => height - padding - ((val - min) / (max - min)) * (height - padding * 2);
  const points = data.map((d, i) => `${padding + i * stepX},${scaleY(d.avg)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="trend-mini-chart">
      {[0, 1, 2, 3, 4].map((v) => (
        <g key={v}>
          <line x1={padding} x2={width - padding} y1={scaleY(v)} y2={scaleY(v)} stroke="#eee" strokeWidth="1" />
          <text x={padding - 8} y={scaleY(v)} fontSize="9" textAnchor="end" dominantBaseline="middle" fill="#9ca3af">
            {v}
          </text>
        </g>
      ))}

      <polyline points={points} fill="none" stroke="#2f80ed" strokeWidth="2" />

      {data.map((d, i) => (
        <g key={`pt-${i}`}>
          <circle cx={padding + i * stepX} cy={scaleY(d.avg)} r="4" fill={getRatingColor(d.avg)}>
            <title>{`${d.label}: ${d.avg.toFixed(2)}`}</title>
          </circle>

          <text x={padding + i * stepX} y={scaleY(d.avg) - 10} fontSize="9" textAnchor="middle" fill="#4b5563" fontWeight="600">
            {d.avg.toFixed(2)}
          </text>
        </g>
      ))}

      {data.map((d, i) => (
        <text key={`lbl-${i}`} x={padding + i * stepX} y={height - 8} fontSize="9" textAnchor="middle" fill="#666">
          {d.label.split(" ")[0]}
        </text>
      ))}
    </svg>
  );
}

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

function SupervisorDataVisuals({ worker }) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPeriodScoped, setIsPeriodScoped] = useState(false);

  /* TREND — independent of the main period filter below */
  const [trendRange, setTrendRange] = useState("sixMonths");
  const [trendRaw, setTrendRaw] = useState([]);
  const [trendLoading, setTrendLoading] = useState(true);

  /* PERIOD FILTER */
  const [filterMode, setFilterMode] = useState("month");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterQuarter, setFilterQuarter] = useState("");
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [activeFilter, setActiveFilter] = useState("");
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);

  const [ratingView, setRatingView] = useState("all");
  const [filterArea, setFilterArea] = useState("all");

  const [minRaters, setMinRaters] = useState(0);
  const [minRatersInput, setMinRatersInput] = useState("0");

  const handleMinRatersChange = (e) => {
    const raw = e.target.value;
    setMinRatersInput(raw);

    const parsed = parseInt(raw, 10);
    setMinRaters(Number.isNaN(parsed) || parsed < 0 ? 0 : parsed);
  };

  const handleMinRatersBlur = () => {
    setMinRatersInput(String(minRaters));
  };

  /* MODALS */
  const [showBelowTwoModal, setShowBelowTwoModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [feedback, setFeedback] = useState({ isOpen: false, title: "", message: "", type: "info" });

  const quarterOptions = useMemo(() => generateQuarterOptions(), []);
  const checklistOptions = useMemo(() => generateMonthChecklistOptions(), []);

  const buildViewParams = useCallback(() => ({ ratingView }), [ratingView]);

  /* FETCH SINGLE MONTH */
  const fetchSingleMonth = useCallback(
    async (month = "") => {
      try {
        setLoading(true);
        const response = await supervisorService.getDashboard(month || undefined, worker?._id, buildViewParams());
        const data = response.data || [];

        setWorkers(data);
        setIsPeriodScoped(Boolean(month));
      } catch (err) {
        console.error("Error fetching chart data:", err);
      } finally {
        setLoading(false);
      }
    },
    [worker?._id, buildViewParams]
  );

  /* FETCH MULTIPLE MONTHS */
  const fetchMonthGroup = useCallback(
    async (months) => {
      try {
        setLoading(true);

        const responses = await Promise.all(
          months.map((m) => supervisorService.getDashboard(m, worker?._id, buildViewParams()))
        );

        const workerMap = new Map();

        responses.forEach((res) => {
          const monthData = res.data || [];

          monthData.forEach((w) => {
            const raterIds = w.monthRaterIds || [];
            const ratingsCount = w.monthRatingsCount || 0;

            if (!workerMap.has(w._id)) {
              workerMap.set(w._id, {
                ...w,
                _raterIdSet: new Set(raterIds),
                _ratingsCountSum: ratingsCount,
                _scoreTotal: typeof w.monthAverageRating === "number" ? w.monthAverageRating * ratingsCount : 0,
                _kpiTotals: Object.fromEntries(
                  ratingFields.map(({ key }) => [key, (w.monthKpiAverages?.[key] || 0) * ratingsCount])
                )
              });
            } else {
              const existing = workerMap.get(w._id);
              existing._ratingsCountSum += ratingsCount;
              if (typeof w.monthAverageRating === "number") {
                existing._scoreTotal += w.monthAverageRating * ratingsCount;
              }
              ratingFields.forEach(({ key }) => {
                existing._kpiTotals[key] += (w.monthKpiAverages?.[key] || 0) * ratingsCount;
              });
              raterIds.forEach((id) => existing._raterIdSet.add(id));

              if (new Date(w.latestRating?.createdAt || 0) > new Date(existing.latestRating?.createdAt || 0)) {
                existing.latestRating = w.latestRating;
              }
            }
          });
        });

        // Sums ratings/raters across every month in the group, so a
        // quarter's "ratings received" reflects the whole quarter, not
        // just whichever single month had the best average.
        const mergedData = Array.from(workerMap.values()).map(({ _raterIdSet, _ratingsCountSum, _scoreTotal, _kpiTotals, ...rest }) => ({
          ...rest,
          monthAverageRating: _ratingsCountSum > 0 ? _scoreTotal / _ratingsCountSum : null,
          monthKpiAverages: Object.fromEntries(
            ratingFields.map(({ key }) => [key, _ratingsCountSum > 0 ? _kpiTotals[key] / _ratingsCountSum : 0])
          ),
          monthRatingsCount: _ratingsCountSum,
          monthRaterIds: Array.from(_raterIdSet)
        }));

        setWorkers(mergedData);
        setIsPeriodScoped(true);
      } catch (err) {
        console.error("Error fetching grouped month data:", err);
      } finally {
        setLoading(false);
      }
    },
    [worker?._id, buildViewParams]
  );

  /* RATING TREND — fetches raw per-month data for the selected range.
     Area filtering happens client-side in the `trend` memo below, so
     switching the area dropdown doesn't need a refetch. */
  const fetchTrendRaw = useCallback(async () => {
    setTrendLoading(true);
    const count = TREND_RANGE_MONTHS[trendRange] || 6;
    const monthsAsc = generateMonthChecklistOptions(count).slice().reverse();

    try {
      const responses = await Promise.all(
        monthsAsc.map((opt) => supervisorService.getDashboard(opt.key, worker?._id, buildViewParams()))
      );

      const raw = monthsAsc.map((opt, idx) => ({
        label: opt.label,
        data: responses[idx].data || []
      }));

      setTrendRaw(raw);
    } catch (err) {
      console.error("Error fetching trend data:", err);
    } finally {
      setTrendLoading(false);
    }
  }, [worker?._id, buildViewParams, trendRange]);

  useEffect(() => {
    fetchSingleMonth();
    // Initial load only. Filter changes are handled by Apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Independent from the main "Apply" period filter: refetches whenever
  // the trend range or rating view changes.
  useEffect(() => {
    fetchTrendRaw();
  }, [fetchTrendRaw]);

  const trend = useMemo(() => {
    return trendRaw.map(({ label, data }) => {
      const filtered = data.filter((w) => (
        filterArea === "all"
        || (filterArea === "unassigned" ? !w.area : w.area === filterArea)
      ));

      const scores = filtered
        .map((w) => (typeof w.monthAverageRating === "number" ? w.monthAverageRating : null))
        .filter((v) => v !== null);

      const avg = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;

      return { label, avg: Number(avg.toFixed(2)) };
    });
  }, [trendRaw, filterArea]);

  const toggleMonthChecked = (key) => {
    setSelectedMonths((prev) => (prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]));
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
        setFeedback({ isOpen: true, title: t("supervisorVisuals.filterBy"), message: t("supervisorVisuals.noMonthsSelected"), type: "info" });
        return;
      }

      fetchMonthGroup(selectedMonths);

      setActiveFilter(
        selectedMonths.length <= 3
          ? selectedMonths.join(", ")
          : `${selectedMonths.length} ${t("supervisorVisuals.monthsSelected")}`
      );
    }

    setShowPeriodPicker(false);
  };

  const handleResetFilter = () => {
    setFilterMonth("");
    setFilterQuarter("");
    setSelectedMonths([]);
    setFilterArea("all");
    setActiveFilter("");

    fetchSingleMonth("");
  };

  const filteredWorkers = useMemo(() => workers.filter((w) => (
    filterArea === "all"
    || (filterArea === "unassigned" ? !w.area : w.area === filterArea)
  )), [workers, filterArea]);
  const selectedMonthKeys = useMemo(() => {
    if (!activeFilter) return null;
    if (filterMode === "month") return filterMonth ? new Set([filterMonth]) : null;
    if (filterMode === "quarter") {
      return new Set(quarterOptions.find((quarter) => quarter.key === filterQuarter)?.months || []);
    }
    return new Set(selectedMonths);
  }, [activeFilter, filterMode, filterMonth, filterQuarter, quarterOptions, selectedMonths]);
  const filteredStats = useMemo(
    () => buildStats(filteredWorkers, isPeriodScoped, minRaters, selectedMonthKeys),
    [filteredWorkers, isPeriodScoped, minRaters, selectedMonthKeys]
  );
  const areaStats = useMemo(() => buildAreaStats(workers, isPeriodScoped), [workers, isPeriodScoped]);
  const ratedWorkers = useMemo(() => filteredWorkers.filter((w) => {
    const score = isPeriodScoped ? w.monthAverageRating : w.cumulativeAverageRating;
    const count = isPeriodScoped ? w.monthRatingsCount : w.cumulativeRatingsCount;
    return typeof score === "number" && count > 0;
  }), [filteredWorkers, isPeriodScoped]);
  const totalWorkers = filteredWorkers.length;
  const getBarWidth = (count) => (totalWorkers > 0 ? (count / totalWorkers) * 100 : 0);

  const getKpiAverage = (key) => {
    const kpiValues = ratedWorkers
      .map((w) => (isPeriodScoped ? w.monthKpiAverages?.[key] : w.cumulativeKpiAverages?.[key]))
      .filter((v) => typeof v === "number");
    if (kpiValues.length === 0) return 0;
    return kpiValues.reduce((sum, v) => sum + v, 0) / kpiValues.length;
  };

  const pieData = useMemo(() => {
    const total = PIE_SEGMENTS.reduce((sum, segment) => sum + (filteredStats.ratingDistribution[segment.key] || 0), 0);

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
      const count = filteredStats.ratingDistribution[segment.key] || 0;
      const percent = (count / total) * 100;
      const start = cumulative;
      const end = cumulative + percent;

      colorStops.push(`${segment.color} ${start}% ${end}%`);
      cumulative = end;

      return { ...segment, count, percent };
    });

    return { background: `conic-gradient(${colorStops.join(", ")})`, total, legend };
  }, [filteredStats.ratingDistribution]);

  const stats = filteredStats;

  const periodLabel = useMemo(() => {
    if (activeFilter) return activeFilter;
    return t("supervisorVisuals.allTime") || "All Time";
  }, [activeFilter, t]);

  const belowTwoLabel = activeFilter
    ? (t("supervisorVisuals.belowTwoTitle") || "Below 2.0")
    : (t("supervisorVisuals.belowTwoAllTimeTitle") || "Workers rated at or below 2.0");

  const viewLabel = useMemo(() => {
    if (ratingView === "supervisor") return t("supervisorVisuals.viewSupervisor") || "Supervisor Ratings";
    if (ratingView === "own") return t("supervisorVisuals.viewOwn") || "My Ratings";
    return t("supervisorVisuals.viewAll") || "All Ratings";
  }, [ratingView, t]);

  const calibrationLabel = useMemo(() => {
    if (!minRaters) return "";
    return ` • ${minRaters}+ ${t("supervisorVisuals.ratersLabel") || "raters"}`;
  }, [minRaters, t]);

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading">{t("supervisorVisuals.loading")}</div>
      </div>
    );
  }

  return (
    <div className="page-content supervisor-visuals">
      <FeedbackDialog {...feedback} closeText={t("common.close")} onClose={() => setFeedback((prev) => ({ ...prev, isOpen: false }))} />

      <div className="page-header supervisor-ratings-header">
        <div>
          <h1>{t("supervisorVisuals.title")}</h1>
          <p>{t("supervisorVisuals.subtitle")}</p>
        </div>

        <div className="period-filter-wrap">
          <div className="period-filter-card" onClick={() => setShowPeriodPicker((prev) => !prev)}>
            <span className="period-icon">📅</span>

            <div className="period-info">
              <span className="period-label">{viewLabel}</span>
              <span className="period-value">{periodLabel}{calibrationLabel}</span>
            </div>

            <span className="period-toggle">{showPeriodPicker ? "▲" : "▼"}</span>
          </div>

          {showPeriodPicker && (
            <div className="period-picker-dropdown">

              {/* RATING VIEW */}
              <div className="wf-filter-group">
                <label>{t("supervisorVisuals.ratingView") || "Rating View"}</label>

                <select className="sort-select" value={ratingView} onChange={(e) => setRatingView(e.target.value)}>
                  <option value="all">{t("supervisorVisuals.viewAll") || "All Ratings"}</option>
                  <option value="supervisor">{t("supervisorVisuals.viewSupervisor") || "Supervisor Ratings"}</option>
                  <option value="own">{t("supervisorVisuals.viewOwn") || "My Ratings"}</option>
                </select>
              </div>

              <div className="wf-filter-group">
                <label>{t("common.area")}</label>
                <select className="sort-select" value={filterArea} onChange={(e) => setFilterArea(e.target.value)}>
                  <option value="all">{t("common.allAreas")}</option>
                  <option value="unassigned">{t("common.unassigned")}</option>
                  {WORKER_AREAS.map((area) => <option key={area} value={area}>{area}</option>)}
                </select>
              </div>

              {/* CALIBRATION — applies instantly, no Apply click needed */}
              <div className="wf-filter-group">
                <label>{t("supervisorVisuals.minRaters") || "Minimum Raters"}</label>

                <input
                  type="number"
                  className="sort-select"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={minRatersInput}
                  onChange={handleMinRatersChange}
                  onBlur={handleMinRatersBlur}
                  placeholder={t("supervisorVisuals.anyRaters") || "Any"}
                />
              </div>

              {/* PERIOD MODE */}
              <div className="wf-filter-group">
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

              {/* MONTH */}
              {filterMode === "month" && (
                <div className="wf-filter-group">
                  <label>{t("supervisorVisuals.byMonth")}</label>
                  <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
                </div>
              )}

              {/* QUARTER */}
              {filterMode === "quarter" && (
                <div className="wf-filter-group">
                  <label>{t("supervisorVisuals.byQuarter")}</label>

                  <select className="sort-select" value={filterQuarter} onChange={(e) => setFilterQuarter(e.target.value)}>
                    <option value="">{t("supervisorVisuals.selectQuarter")}</option>
                    {quarterOptions.map((q) => (
                      <option key={q.key} value={q.key}>{q.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* CHECKLIST */}
              {filterMode === "checklist" && (
                <div className="wf-filter-group dv-checklist-group">
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

              {/* APPLY / RESET */}
              <button className="wf-btn-apply" onClick={handleApplyFilter}>
                {t("supervisorVisuals.apply")}
              </button>

              {activeFilter && (
                <button className="wf-btn-reset" onClick={handleResetFilter}>
                  x {activeFilter}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="visuals-summary">
        <div className="summary-card">
          <div className="summary-card-title">
            <Users size={16} />
            <h3>{t("supervisorVisuals.ratedCountTitle") || "Rated / Total"}</h3>
          </div>
          <div className="big-stat">{stats.ratedCount} / {totalWorkers}</div>
          <p className="summary-note">{t("supervisorVisuals.ratedCountNote") || "Workers rated this period"}</p>
        </div>

        <div className="summary-card">
          <div className="summary-card-title">
            <UserX size={16} />
            <h3>{t("supervisorVisuals.notRatedCountTitle") || "Not Rated / Total"}</h3>
          </div>
          <div className="big-stat" style={{ color: "#9e9e9e" }}>{totalWorkers - stats.ratedCount} / {totalWorkers}</div>
          <p className="summary-note">{t("supervisorVisuals.notRatedCountNote") || "Workers without a rating"}</p>
        </div>

        <div className="summary-card">
          <div className="summary-card-title">
            <Star size={16} />
            <h3>{t("supervisorVisuals.avgRatingTitle") || "Average Rating"}</h3>
          </div>
          <div className="big-stat" style={{ color: getRatingColor(Number(stats.avgRating)) }}>{stats.avgRating}</div>
          <p className="summary-note">
            {(t("supervisorVisuals.basedOnWorkers") || "Based on {count} rated workers").replace("{count}", String(stats.ratedCount))}
          </p>
        </div>

        <div className="summary-card">
          <div className="summary-card-title">
            <AlertTriangle size={16} />
            <h3>{belowTwoLabel}</h3>
          </div>
          <div className="big-stat" style={{ color: "#e74c3c" }}>
            {activeFilter ? `${stats.belowTwoWorkers.length} / ${totalWorkers}` : stats.belowTwoWorkers.length}
          </div>
          <button type="button" className="summary-card-link" onClick={() => setShowBelowTwoModal(true)}>
            {t("supervisorVisuals.seeDetails") || "See details"}
          </button>
        </div>
      </div>

      {totalWorkers === 0 ? (
        <div className="no-data">{t("supervisorVisuals.noDataFilter")}</div>
      ) : (
        <>
          {/* RATING DISTRIBUTION */}
          <div className="chart-section">
            <h2>{t("supervisorVisuals.ratingDistribution")}</h2>

            <div className="distribution-container">
              {PIE_SEGMENTS.map((item) => (
                <div key={item.key} className="distribution-bar">
                  <div className="bar-label">
                    <span>{item.key === "notRated" ? t("supervisorVisuals.notRatedLabel") : t(item.labelKey)}</span>
                    <span>{stats.ratingDistribution[item.key] || 0}</span>
                  </div>

                  <div className="bar-background">
                    <div
                      className="bar-fill"
                      style={{ width: `${getBarWidth(stats.ratingDistribution[item.key] || 0)}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PIE + TREND */}
          <div className="chart-row">
            <div className="chart-section chart-half">
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
                      <span className="pie-label">{item.key === "notRated" ? t("supervisorVisuals.notRatedLabel") : t(item.labelKey)}</span>
                      <span className="pie-value">{item.count} ({item.percent.toFixed(0)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="chart-section chart-half">
              <div className="chart-section-header-row">
                <h2>{t("supervisorVisuals.trendTitle") || "Rating Trend"}</h2>

                <div className="filter-buttons">
                  <button
                    type="button"
                    className={`filter-btn ${trendRange === "monthly" ? "active" : ""}`}
                    onClick={() => setTrendRange("monthly")}
                    disabled={trendLoading}
                  >
                    {t("supervisorVisuals.trendMonthly") || "Monthly"}
                  </button>

                  <button
                    type="button"
                    className={`filter-btn ${trendRange === "sixMonths" ? "active" : ""}`}
                    onClick={() => setTrendRange("sixMonths")}
                    disabled={trendLoading}
                  >
                    {t("supervisorVisuals.trendSixMonths") || "6 Months"}
                  </button>

                  <button
                    type="button"
                    className={`filter-btn ${trendRange === "yearly" ? "active" : ""}`}
                    onClick={() => setTrendRange("yearly")}
                    disabled={trendLoading}
                  >
                    {t("supervisorVisuals.trendYearly") || "Yearly"}
                  </button>
                </div>
              </div>

              {trendLoading ? (
                <div className="trend-loading">
                  <span className="trend-spinner" />
                  <span>{t("supervisorVisuals.trendLoading") || "Loading trend..."}</span>
                </div>
              ) : (
                <TrendMiniChart data={trend} emptyLabel={t("supervisorVisuals.noTrendData") || "No trend data yet"} />
              )}
            </div>
          </div>

          {/* AREA PERFORMANCE */}
          <div className="chart-section">
            <h2>{t("supervisorVisuals.areaPerformance") || "Performance by Area"}</h2>
            <p className="kpi-note">
              {t("supervisorVisuals.areaPerformanceNote") || "Average rating per work area for the selected period."}
            </p>

            <div className="skills-overview">
              {areaStats.map((item) => {
                const label = item.area === "unassigned" ? (t("common.unassigned") || "Unassigned") : item.area;
                const color = item.ratedCount > 0 ? getRatingColor(item.avg) : "#d1d5db";

                return (
                  <div className="skill-item" key={item.area}>
                    <span className="skill-name">{label}</span>

                    <div className="skill-bar">
                      <div className="skill-fill" style={{ width: `${(item.avg / 4) * 100}%`, backgroundColor: color }} />
                    </div>

                    <span className="skill-value" style={{ color }}>
                      {item.ratedCount > 0 ? item.avg.toFixed(2) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TOP PERFORMERS */}
          <div className="chart-section">
            <div className="chart-section-header-row">
              <h2>{t("supervisorVisuals.topPerformers")}</h2>
            </div>

            <div className="top-performers">
              {stats.topRated.map((w, index) => (
                <div key={w._id} className="performer-item">
                  <div className="performer-info">
                    <h4>#{index + 1}</h4>
                    <button
                      type="button"
                      className="performer-name"
                      onClick={() => navigate(`/worker/${w._id}`)}
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                    >
                      {w.name}
                    </button>
                    <p className="performer-email">{w.email}</p>
                  </div>

                  <div className="performer-rating">
                    <span className="rating-badge-large" style={{ backgroundColor: getRatingColor(w._score) }}>
                      {Number(w._score).toFixed(2)}
                    </span>
                  </div>

                  <div className="performer-meta">
                    <p>{w.area || t("common.unassigned") || "Unassigned"}</p>
                    <p>
                      {w._ratingsCount || 0} {t("supervisorVisuals.ratings")}
                      {" · "}
                      {w._ratersCount || 0} {t("supervisorVisuals.ratersLabel") || "raters"}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginTop: "14px" }}>
              <button className="dv-btn-apply" onClick={() => setShowLeaderboard(true)}>
                {t("supervisorVisuals.viewLeaderboard") || "View Full Leaderboard"}
              </button>
            </div>
          </div>

          {/* KPI AVERAGES */}
          <div className="chart-section">
            <h2>{t("supervisorVisuals.kpiAverages")}</h2>
            <p className="kpi-note">{t("supervisorVisuals.kpiNote").replace("{count}", String(ratedWorkers.length))}</p>

            <div className="skills-overview">
              {ratingFields.map((field) => {
                const avg = getKpiAverage(field.key);
                const color = getRatingColor(avg);

                return (
                  <div className="skill-item" key={field.key}>
                    <span className="skill-name">{t(`kpi.${field.key}`)}</span>

                    <div className="skill-bar">
                      <div className="skill-fill" style={{ width: `${(avg / 4) * 100}%`, backgroundColor: color }} />
                    </div>

                    <span className="skill-value" style={{ color }}>{avg.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* BELOW 2.0 MODAL */}
      {showBelowTwoModal && (
        <div className="confirm-dialog-overlay" onClick={() => setShowBelowTwoModal(false)}>
          <div
            className="confirm-dialog-card"
            onClick={(e) => e.stopPropagation()}
            style={{ display: "flex", flexDirection: "column", maxHeight: "80vh", width: "min(900px, 94vw)" }}
          >
            <h3 style={{ marginBottom: "4px" }}>
              {belowTwoLabel} — {periodLabel}
            </h3>

            {stats.belowTwoWorkers.length === 0 ? (
              <p>{t("supervisorVisuals.noWorkersBelowTwo") || "No workers below 2.0 right now."}</p>
            ) : (
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", marginTop: "10px", paddingRight: "4px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {stats.belowTwoWorkers.map((w) => (
                  <div
                    key={w._id}
                    style={{ background: "#f9fafb", borderRadius: "10px", padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <div>
                      <button
                        type="button"
                        onClick={() => navigate(`/worker/${w._id}`)}
                        style={{ background: "none", border: "none", padding: 0, color: "#111827", fontWeight: 600, cursor: "pointer" }}
                      >
                        {w.name}
                      </button>
                      {!activeFilter && w._lowRatingHistory.map((entry, index) => (
                        <div key={`${w._id}-${entry.dateKey}-${index}`} style={{ color: "#6b7280", fontSize: "12px", marginTop: "4px" }}>
                          {formatMonthKey(entry.dateKey)}: {entry.average.toFixed(2)} ★
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                      <span style={{ color: getRatingColor(w._score), fontWeight: 700 }}>{Number(w._score).toFixed(2)} ★</span>
                      <span style={{ color: "#9ca3af", fontSize: "11px" }}>
                        {w._ratersCount || 0} {t("supervisorVisuals.ratersLabel") || "raters"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="confirm-dialog-actions" style={{ marginTop: "12px" }}>
              <button type="button" className="btn" onClick={() => setShowBelowTwoModal(false)}>
                {t("common.close") || "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL LEADERBOARD MODAL */}
      {showLeaderboard && (
        <div className="confirm-dialog-overlay" onClick={() => setShowLeaderboard(false)}>
          <div
            className="confirm-dialog-card"
            onClick={(e) => e.stopPropagation()}
            style={{ display: "flex", flexDirection: "column", maxHeight: "80vh", width: "min(900px, 94vw)" }}
          >
            <h3 style={{ marginBottom: "4px" }}>
              {t("supervisorVisuals.leaderboardTitle") || "Full Leaderboard"} — {periodLabel}{calibrationLabel}
            </h3>

            {stats.allRanked.length === 0 ? (
              <p>{t("supervisorVisuals.noRankedWorkers") || "No rated workers for this period."}</p>
            ) : (
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", marginTop: "10px", paddingRight: "4px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {stats.allRanked.map((w, idx) => (
                  <div
                    key={w._id}
                    style={{ background: "#f9fafb", borderRadius: "10px", padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
                      <span style={{ color: "#9ca3af", fontWeight: 700, width: "20px", flexShrink: 0 }}>#{idx + 1}</span>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <button
                          type="button"
                          onClick={() => navigate(`/worker/${w._id}`)}
                          style={{ color: "#111827", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                        >
                          {w.name}
                        </button>
                        <div style={{ color: "#9ca3af", fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {w.email}{w.area ? ` · ${w.area}` : ""}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                      <span style={{ color: getRatingColor(w._score), fontWeight: 700 }}>{Number(w._score).toFixed(2)} ★</span>
                      <span style={{ color: "#9ca3af", fontSize: "12px" }}>
                        {w._ratingsCount || 0} {t("supervisorVisuals.ratings")} · {w._ratersCount || 0} {t("supervisorVisuals.ratersLabel") || "raters"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="confirm-dialog-actions" style={{ marginTop: "12px" }}>
              <button type="button" className="btn" onClick={() => setShowLeaderboard(false)}>
                {t("common.close") || "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SupervisorDataVisuals;