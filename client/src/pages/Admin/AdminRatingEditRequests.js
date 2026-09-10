import { useEffect, useState, useCallback } from "react";
import { adminService } from "../../services/api";
import { useLanguage } from "../../context/LanguageContext";
import "../../styles/Admin/AdminPages.css";

function AdminRatingEditRequests() {
  const admin = JSON.parse(localStorage.getItem("worker") || "{}");
  const { t } = useLanguage();
  const [requests, setRequests] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [lateSubmissionRequests, setLateSubmissionRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState("");
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [requestsRes, workersRes, lateSubmissionRes] = await Promise.all([
        adminService.getPendingRatingEditRequests(),
        adminService.getPendingWorkerApprovals(),
        adminService.getPendingLateSubmissionRequests()
      ]);
      setRequests(requestsRes.data || []);
      setWorkers(workersRes.data || []);
      setLateSubmissionRequests(Array.isArray(lateSubmissionRes.data) ? lateSubmissionRes.data : []);
    } catch (err) {
      setError(err.response?.data?.message || t("adminEditRequests.loading"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReview = async (ratingId, action) => {
    try {
      setSubmittingId(ratingId);
      await adminService.reviewRatingEditRequest(ratingId, admin._id, action);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || t("common.cancel"));
    } finally {
      setSubmittingId("");
    }
  };

  const handleReviewLateSubmission = async (requestId, action) => {
    try {
      setSubmittingId(requestId);
      await adminService.getLateSubmissionRequests(requestId, admin._id, action);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || t("common.cancel"));
    } finally {
      setSubmittingId("");
    }
  };

  const handleApprove = async (workerId) => {
    try {
      setSubmittingId(workerId);
      setError("");
      await adminService.approveWorker(workerId);
      setWorkers(workers.filter((w) => w._id !== workerId));
    } catch (err) {
      setError(err.response?.data?.message || t("adminApprovals.approveFailed"));
    } finally {
      setSubmittingId("");
    }
  };

  const handleReject = async (workerId) => {
    try {
      setSubmittingId(workerId);
      setError("");
      await adminService.rejectWorker(workerId);
      setWorkers(workers.filter((w) => w._id !== workerId));
    } catch (err) {
      setError(err.response?.data?.message || t("adminApprovals.rejectFailed"));
    } finally {
      setSubmittingId("");
    }
  };

  return (
    <div className="page-content admin-page">
      <div className="page-header">
        <h1>📋 {t("adminEditRequests.title")}</h1>
        <p>{t("adminEditRequests.subtitle")}</p>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {loading ? (
        <div className="admin-loading">
          <span>⏳</span> {t("adminEditRequests.loading")}
        </div>
      ) : (
        <>
          {/* ===== WORKER APPROVALS SECTION ===== */}
          <div className="admin-section admin-card" style={{ marginBottom: "40px" }}>
            <h2 className="section-title">👷 {t("adminEditRequests.workerApprovalsTitle")}</h2>
            {workers.length === 0 ? (
              <div className="admin-empty">{t("adminEditRequests.noWorkerApprovals")}</div>
            ) : (
              <div className="table-responsive admin-table">
                <table className="workers-table admin-home-table">
                  <thead>
                    <tr>
                      <th>{t("adminEditRequests.name")}</th>
                      <th>{t("adminEditRequests.email")}</th>
                      <th>{t("adminEditRequests.registeredAt")}</th>
                      <th>{t("adminEditRequests.action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((worker) => (
                      <tr key={worker._id}>
                        <td data-label={t("adminEditRequests.name")}>{worker.name}</td>
                        <td data-label={t("adminEditRequests.email")}>{worker.email}</td>
                        <td data-label={t("adminEditRequests.registeredAt")}>
                          {new Date(worker.createdAt).toLocaleString()}
                        </td>
                        <td data-label={t("adminEditRequests.action")}>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleApprove(worker._id)}
                            disabled={submittingId === worker._id}
                            style={{ marginRight: 8 }}
                          >
                            {submittingId === worker._id ? t("adminEditRequests.processing") : `✓ ${t("adminEditRequests.approve")}`}
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() => handleReject(worker._id)}
                            disabled={submittingId === worker._id}
                          >
                            {submittingId === worker._id ? t("adminEditRequests.processing") : `✕ ${t("adminEditRequests.reject")}`}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ===== RATING EDIT REQUESTS SECTION ===== */}
          <div className="admin-section admin-card" style={{ marginBottom: "40px" }}>
            <h2 className="section-title">📝 {t("adminEditRequests.ratingEditRequestsTitle")}</h2>
            {requests.length === 0 ? (
              <div className="admin-empty">{t("adminEditRequests.noEditRequests")}</div>
            ) : (
              <div className="table-responsive admin-table">
                <table className="workers-table admin-home-table">
                  <thead>
                    <tr>
                      <th>{t("adminEditRequests.rater")}</th>
                      <th>{t("adminEditRequests.ratedUser")}</th>
                      <th>{t("adminEditRequests.month")}</th>
                      <th>{t("adminEditRequests.requestedAt")}</th>
                      <th>{t("adminEditRequests.reason")}</th>
                      <th>{t("adminEditRequests.action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => (
                      <tr key={r._id}>
                        <td data-label={t("adminEditRequests.rater")}>
                          {r.ratedBy?.name || "-"}
                          <div className="text-muted">{r.ratedBy?.email || "-"}</div>
                        </td>
                        <td data-label={t("adminEditRequests.ratedUser")}>
                          {r.ratedUser?.name || "-"}
                          <div className="text-muted">{r.ratedUser?.email || "-"}</div>
                        </td>
                        <td data-label={t("adminEditRequests.month")}>{r.dateKey || "-"}</td>
                        <td data-label={t("adminEditRequests.requestedAt")}>
                          {r.workerEditRequestAt ? new Date(r.workerEditRequestAt).toLocaleString() : "-"}
                        </td>
                        <td data-label={t("adminEditRequests.reason")}>{r.workerEditRequestReason || "-"}</td>
                        <td data-label={t("adminEditRequests.action")}>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleReview(r._id, "approve")}
                            disabled={submittingId === r._id}
                            style={{ marginRight: 8 }}
                          >
                            {submittingId === r._id ? t("adminEditRequests.processing") : t("adminEditRequests.approve")}
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() => handleReview(r._id, "reject")}
                            disabled={submittingId === r._id}
                          >
                            {submittingId === r._id ? t("adminEditRequests.processing") : t("adminEditRequests.reject")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ===== LATE SUBMISSION PERMISSION REQUESTS SECTION ===== */}
          <div className="admin-section admin-card">
            <h2 className="section-title">🕒 {t("adminEditRequests.lateSubmissionRequestsTitle")}</h2>
            {lateSubmissionRequests.length === 0 ? (
              <div className="admin-empty">{t("adminEditRequests.noLateSubmissionRequests")}</div>
            ) : (
              <div className="table-responsive admin-table">
                <table className="workers-table admin-home-table">
                  <thead>
                    <tr>
                      <th>{t("adminEditRequests.rater")}</th>
                      <th>{t("adminEditRequests.ratedUser")}</th>
                      <th>{t("adminEditRequests.month")}</th>
                      <th>{t("adminEditRequests.requestedAt")}</th>
                      <th>{t("adminEditRequests.reason")}</th>
                      <th>{t("adminEditRequests.action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lateSubmissionRequests.map((r) => (
                      <tr key={r._id}>
                        <td data-label={t("adminEditRequests.rater")}>
                          {r.ratedBy?.name || "-"}
                        </td>
                        <td data-label={t("adminEditRequests.ratedUser")}>
                          {r.ratedUser?.name || "-"}
                        </td>
                        <td data-label={t("adminEditRequests.month")}>{r.dateKey || "-"}</td>
                        <td data-label={t("adminEditRequests.requestedAt")}>
                          {r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}
                        </td>
                        <td data-label={t("adminEditRequests.reason")}>{r.reason || "-"}</td>
                        <td data-label={t("adminEditRequests.action")}>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleReviewLateSubmission(r._id, "approve")}
                            disabled={submittingId === r._id}
                            style={{ marginRight: 8 }}
                          >
                            {submittingId === r._id ? t("adminEditRequests.processing") : t("adminEditRequests.approve")}
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() => handleReviewLateSubmission(r._id, "reject")}
                            disabled={submittingId === r._id}
                          >
                            {submittingId === r._id ? t("adminEditRequests.processing") : t("adminEditRequests.reject")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default AdminRatingEditRequests;