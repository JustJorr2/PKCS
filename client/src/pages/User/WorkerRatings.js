import { useState, useEffect, useCallback, useMemo } from "react";
import { ratingsService, supervisorService } from "../../services/api";
import RatingForm from "../../components/RatingForm";
import "../../styles/Supervisor/SupervisorPages.css";
import "../../styles/User/WorkerDashboard.css";
import { useLanguage } from "../../context/LanguageContext";
import { config } from "../../config/config";

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

function WorkerRatings({ worker }) {
  const { t } = useLanguage();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingWorker, setRatingWorker] = useState(null);
  const [editingRating, setEditingRating] = useState(null);
  const [ratedWorkerIds, setRatedWorkerIds] = useState(new Set());
  const [ratedWorkerMap, setRatedWorkerMap] = useState({});
  const [lateSubmissionMap, setLateSubmissionMap] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(getPreviousMonthKey());
  const [filterMonth, setFilterMonth] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [editRequestModal, setEditRequestModal] = useState({ isOpen: false, workerId: null, reason: "" });
  const [lateSubmissionModal, setLateSubmissionModal] = useState({ isOpen: false, workerId: null, reason: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchWorkers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await supervisorService.getDashboard(selectedMonth, worker._id);
      const filtered = res.data.filter(
        (u) => u.role === "worker" && u._id !== worker._id
      );
      setWorkers(filtered);
    } catch (err) {
      console.error("Error fetching workers:", err);
    } finally {
      setLoading(false);
    }
  }, [worker._id, selectedMonth]);

  function getAllowedRatingMonths() {
    const months = [];

    for (let i = 1; i <= 2; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);

      months.push(
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      );
    }

    return months;
  }

  const allowedRatingMonths = getAllowedRatingMonths();

  const isRatingMonthAvailable =
    allowedRatingMonths.includes(selectedMonth);

  const fetchWorkerRatings = useCallback(async () => {
    if (!worker?._id) {
      setRatedWorkerIds(new Set());
      return;
    }
    try {
      const response = await supervisorService.getSupervisorRatings(worker._id, selectedMonth);
      const ratedIds = new Set((response.data || []).map((rating) => String(rating.ratedUser)));
      const map = (response.data || []).reduce((acc, rating) => {
        acc[String(rating.ratedUser)] = rating;
        return acc;
      }, {});
      setRatedWorkerIds(ratedIds);
      setRatedWorkerMap(map);
    } catch (err) {
      console.error("Error fetching worker ratings:", err);
    }
  }, [worker?._id, selectedMonth]);

  // Late submission permissions live independently of ratings — a worker can
  // have a pending/approved permission for a month before any Rating document
  // exists. Keep this as its own fetch/map instead of piggybacking on
  // ratedWorkerMap.
  const fetchLateSubmissions = useCallback(async () => {
    if (!worker?._id) {
      setLateSubmissionMap({});
      return;
    }
    try {
      const response = await supervisorService.getLateSubmissionRequests(worker._id, selectedMonth);
      const data = Array.isArray(response.data) ? response.data : [];
      if (!Array.isArray(response.data)) {
        console.warn("getLateSubmissionRequests: expected an array, got:", response.data);
      }
      const map = data.reduce((acc, item) => {
        acc[String(item.ratedUser)] = item;
        return acc;
      }, {});
      setLateSubmissionMap(map);
    } catch (err) {
      console.error("Error fetching late submission requests:", err);
    }
  }, [worker?._id, selectedMonth]);

  useEffect(() => {
    fetchWorkers();
    fetchWorkerRatings();
    fetchLateSubmissions();
  }, [fetchWorkers, fetchWorkerRatings, fetchLateSubmissions]);

  const handleApplyFilter = () => {
    const month = filterMonth || getPreviousMonthKey();
    setSelectedMonth(month);
    setActiveFilter(filterMonth ? `${t("workerRatings.activeFilterMonthPrefix")} ${filterMonth}` : "");
  };

  const handleResetFilter = () => {
    const previousMonth = getPreviousMonthKey();
    setFilterMonth("");
    setActiveFilter("");
    setSelectedMonth(previousMonth);
  };

  const handleRatingSuccess = () => {
    setRatingWorker(null);
    setEditingRating(null);
    fetchWorkers();
    fetchWorkerRatings();
    fetchLateSubmissions();
  };

  const isAlreadyRated = useCallback((workerId) => ratedWorkerIds.has(String(workerId)), [ratedWorkerIds]);

  const handleRequestEdit = async (targetWorkerId) => {
    const rating = ratedWorkerMap[String(targetWorkerId)];
    if (!rating?._id) return;
    setEditRequestModal({ isOpen: true, workerId: targetWorkerId, reason: "" });
  };

  const handleRequestLateSubmission = (targetWorkerId) => {
    setLateSubmissionModal({
      isOpen: true,
      workerId: targetWorkerId,
      reason: ""
    });
  };

  // FIX (Problem 1): no Rating exists yet at this point in the workflow, so
  // this must NOT gate on ratedWorkerMap/rating._id. It only needs a target
  // worker id and a non-empty reason.
  const handleSubmitLateSubmission = async () => {
    if (!lateSubmissionModal.workerId || !lateSubmissionModal.reason.trim()) return;

    try {
      setSubmitting(true);

      await ratingsService.requestLateSubmission(
        worker._id,
        lateSubmissionModal.workerId,
        selectedMonth,
        lateSubmissionModal.reason
      );

      await fetchLateSubmissions();

      setLateSubmissionModal({
        isOpen: false,
        workerId: null,
        reason: ""
      });

    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseLateSubmissionModal = () => {
    setLateSubmissionModal({
      isOpen: false,
      workerId: null,
      reason: ""
    });
  };

  const handleSubmitEditRequest = async () => {
    const rating = ratedWorkerMap[String(editRequestModal.workerId)];
    if (!rating?._id || !editRequestModal.reason.trim()) return;

    try {
      setSubmitting(true);
      await ratingsService.requestWorkerEdit(rating._id, worker._id, editRequestModal.reason);
      await fetchWorkerRatings();
      setEditRequestModal({ isOpen: false, workerId: null, reason: "" });
    } catch (err) {
      alert(err.response?.data?.message || t("workerRatings.submitRequest"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseEditModal = () => {
    setEditRequestModal({ isOpen: false, workerId: null, reason: "" });
  };

  const handleRateWorker = (w) => {
    setEditingRating(null);
    setRatingWorker(w);
  };

  const handleEditWorker = async (targetWorker) => {
    try {
      const response = await supervisorService.getExistingRating(worker._id, targetWorker._id, selectedMonth);
      setEditingRating(response.data || null);
      setRatingWorker(targetWorker);
    } catch (err) {
      alert(err.response?.data?.message || t("workerRatings.edit"));
    }
  };

  const { filteredWorkers, ratedCount, unratedCount } = useMemo(() => {
    const ratedWorkers = workers.filter((w) => isAlreadyRated(w._id)).length;
    const unratedWorkers = workers.length - ratedWorkers;
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const list = workers
      .filter((w) => {
        const matchesSearch = w.name.toLowerCase().includes(normalizedSearch);
        const matchesFilter =
          filterStatus === "all" ||
          (filterStatus === "rated" && isAlreadyRated(w._id)) ||
          (filterStatus === "unrated" && !isAlreadyRated(w._id));
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return { filteredWorkers: list, ratedCount: ratedWorkers, unratedCount: unratedWorkers };
  }, [workers, searchTerm, filterStatus, isAlreadyRated]);

  return (
    <div className="page-content supervisor-details">
      {ratingWorker && (
        <RatingForm
          worker={ratingWorker}
          userId={worker?._id}
          onSuccess={handleRatingSuccess}
          onCancel={() => {
            setRatingWorker(null);
            setEditingRating(null);
          }}
          isEditing={Boolean(editingRating)}
          initialValues={editingRating}
          selectedMonth={selectedMonth}
        />
      )}

      {/* Edit Request Modal */}
      {editRequestModal.isOpen && (
        <div className="modal-overlay" onClick={handleCloseEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
              <h3>{t("workerRatings.modalTitle")}</h3>
              <button className="modal-close" onClick={handleCloseEditModal}>—</button>
            </div>
            <div className="modal-body">
              <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>
                {t("workerRatings.modalReasonLabel")}
              </label>
              <textarea
                value={editRequestModal.reason}
                onChange={(e) => setEditRequestModal({ ...editRequestModal, reason: e.target.value })}
                placeholder={t("workerRatings.modalReasonPlaceholder")}
                style={{
                  width: "100%",
                  minHeight: "100px",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontFamily: "inherit",
                  fontSize: "14px"
                }}
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={handleSubmitEditRequest}
                disabled={submitting || !editRequestModal.reason.trim()}
              >
                {submitting ? t("workerRatings.submitting") : t("workerRatings.submitRequest")}
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleCloseEditModal}
                disabled={submitting}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Late Submission Permission Modal (Problem 2 fix: this was missing entirely) */}
      {lateSubmissionModal.isOpen && (
        <div className="modal-overlay" onClick={handleCloseLateSubmissionModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t("workerRatings.lateSubmissionModalTitle")}</h3>
              <button className="modal-close" onClick={handleCloseLateSubmissionModal}>—</button>
            </div>
            <div className="modal-body">
              <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>
                {t("workerRatings.lateSubmissionReasonLabel")}
              </label>
              <textarea
                value={lateSubmissionModal.reason}
                onChange={(e) => setLateSubmissionModal({ ...lateSubmissionModal, reason: e.target.value })}
                placeholder={t("workerRatings.lateSubmissionReasonPlaceholder")}
                style={{
                  width: "100%",
                  minHeight: "100px",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontFamily: "inherit",
                  fontSize: "14px"
                }}
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={handleSubmitLateSubmission}
                disabled={submitting || !lateSubmissionModal.reason.trim()}
              >
                {submitting ? t("workerRatings.submitting") : t("workerRatings.submitRequest")}
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleCloseLateSubmissionModal}
                disabled={submitting}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1>{t("workerRatings.rateColleaguesTitle")}</h1>
        <p>{t("workerRatings.rateColleaguesSubtitle")}</p>
      </div>

      <div className="wf-filter-bar">
        <div className="wf-filter-inputs">
          <div className="wf-filter-group">
            <label>{t("workerRatings.byMonth")}</label>
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
          </div>
          <button className="wf-btn-apply" onClick={handleApplyFilter}>
            {t("workerRatings.apply")}
          </button>
          {activeFilter && (
            <button className="wf-btn-reset" onClick={handleResetFilter}>
              {t("workerRatings.clearFilter")}
            </button>
          )}
        </div>
      </div>

      <div className="details-stats-row">
        <div className="quick-stat-pill">
          <span className="label">{t("workerRatings.visibleWorkers")}</span>
          <span className="value">{filteredWorkers.length}</span>
        </div>
        <div className="quick-stat-pill">
          <span className="label">{t("workerRatings.ratedByYou")}</span>
          <span className="value">{ratedCount}</span>
        </div>
        <div className="quick-stat-pill">
          <span className="label">{t("workerRatings.notYetRated")}</span>
          <span className="value">{unratedCount}</span>
        </div>
      </div>

      <div className="details-toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder={t("workerRatings.searchByName")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-buttons">
          <button
            className={`filter-btn ${filterStatus === "all" ? "active" : ""}`}
            onClick={() => setFilterStatus("all")}
          >
            {t("workerRatings.all")} ({workers.length})
          </button>
          <button
            className={`filter-btn ${filterStatus === "rated" ? "active" : ""}`}
            onClick={() => setFilterStatus("rated")}
          >
            {t("workerRatings.rated")} ({ratedCount})
          </button>
          <button
            className={`filter-btn ${filterStatus === "unrated" ? "active" : ""}`}
            onClick={() => setFilterStatus("unrated")}
          >
            {t("workerRatings.unrated")} ({unratedCount})
          </button>
        </div>

        <div className="quick-stat-pill">
          <span className="label">{t("workerRatings.ratingMonth")}</span>
          <span className="value">{formatMonthLabel(selectedMonth)}</span>
        </div>
      </div>

      {!isRatingMonthAvailable && (
        <div className="no-data" style={{ marginBottom: "12px" }}>
          {t("workerRatings.ratingUnavailable")} {formatMonthLabel(selectedMonth)}. {t("workerRatings.workersCanOnlyRate")} {allowedRatingMonths
          .map(formatMonthLabel)
          .join(" or ")}.
        </div>
      )}

      {loading ? (
        <div className="loading">{t("workerRatings.loadingWorkers")}</div>
      ) : filteredWorkers.length === 0 ? (
        <div className="no-data">
          {searchTerm ? t("workerRatings.noWorkersSearch") : t("workerRatings.noWorkersDisplay")}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="workers-table worker-ratings-table">
            <thead>
              <tr>
                <th>{t("workerRatings.tableIndex")}</th>
                <th>{t("workerRatings.tableName")}</th>
                <th>{t("workerRatings.tableLastComment")}</th>
                <th>{t("workerRatings.action")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.map((w, index) => (
                <tr key={w._id} className={isAlreadyRated(w._id) ? "rated-row" : ""}>
                  <td data-label={t("workerRatings.tableIndex")}>{index + 1}</td>
                  <td data-label={t("workerRatings.tableName")}>
                    <div className="worker-name-cell">
                      {w.profilePicture ? (
                        <img
                          src={`${config.API_BASE_URL}/${w.profilePicture}`}
                          alt={w.name}
                          className="worker-badge worker-badge-image"
                        />
                      ) : (
                        <div className="worker-badge">
                          {w.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {w.name}
                    </div>
                  </td>

                  <td className="comment-cell" data-label={t("workerRatings.tableLastComment")}>
                    {w.latestComment?.comment ? (
                      <div className="comment-preview" title={w.latestComment.comment}>
                        <span className="comment-text">
                          {w.latestComment.comment.substring(0, 40)}
                          {w.latestComment.comment.length > 40 ? "..." : ""}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted">{t("workerRatings.dash")}</span>
                    )}
                  </td>

                  <td className="action-cell" data-label={t("workerRatings.action")}>

                {(() => {

                const rating = ratedWorkerMap[String(w._id)];
                // Problem 3 fix: permission status lives in its own map, not
                // on the (possibly nonexistent) Rating document.
                const permission = lateSubmissionMap[String(w._id)];

                const isLastMonth =
                  selectedMonth === allowedRatingMonths[0];

                const isTwoMonthsAgo =
                  selectedMonth === allowedRatingMonths[1];

                const isFutureOrTooOld =
                  !allowedRatingMonths.includes(selectedMonth);


                // already rated
                if (isAlreadyRated(w._id)) {

                    if (rating?.workerEditRequestStatus === "pending")
                        return <span className="status-badge">{t("workerRatings.editPending")}</span>;

                    if (rating?.workerEditRequestStatus === "approved")
                        return (
                            <button
                                className="btn btn-primary"
                                onClick={() => handleEditWorker(w)}
                            >
                                {t("workerRatings.edit")}
                            </button>
                        );

                    return (
                        <button
                            className="btn btn-primary"
                            onClick={() => handleRequestEdit(w._id)}
                        >
                            {t("workerRatings.requestEdit")}
                        </button>
                    );
                }


                // LAST MONTH
                if (isLastMonth) {
                    return (
                        <button
                            className="btn btn-primary"
                            onClick={() => handleRateWorker(w)}
                        >
                            {t("workerRatings.rate")}
                        </button>
                    );
                }


                // TWO MONTHS AGO — gated on the permission map, not on a rating
                if (isTwoMonthsAgo) {

                    if (permission?.status === "pending")
                        return (
                            <span className="status-badge">
                                {t("workerRatings.pendingApproval")}
                            </span>
                        );

                    if (permission?.status === "approved")
                        return (
                            <button
                                className="btn btn-primary"
                                onClick={() => handleRateWorker(w)}
                            >
                                {t("workerRatings.rate")}
                            </button>
                        );

                    return (
                        <button
                            className="btn btn-warning"
                            onClick={() => handleRequestLateSubmission(w._id)}
                        >
                            {t("workerRatings.requestPermission")}
                        </button>
                    );
                }


                // Future / Too old
                if (isFutureOrTooOld) {
                    return (
                        <button
                            className="btn btn-secondary"
                            disabled
                        >
                            {t("workerRatings.rate")}
                        </button>
                    );
                }

                return null;

                })()}

                </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default WorkerRatings;