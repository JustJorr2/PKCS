import { useEffect, useState, useCallback } from "react";
import { adminService } from "../../services/api";
import { useLanguage } from "../../context/LanguageContext";
import "../../styles/Admin/AdminPages.css";

function AdminApprovals() {
  const { t } = useLanguage();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionInProgress, setActionInProgress] = useState("");

  const fetchPendingApprovals = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await adminService.getPendingWorkerApprovals();
      setWorkers(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || t("adminApprovals.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPendingApprovals();
  }, [fetchPendingApprovals]);

  const handleApprove = async (workerId) => {
    try {
      setActionInProgress(workerId);
      setError("");
      await adminService.approveWorker(workerId);
      setWorkers(workers.filter((w) => w._id !== workerId));
    } catch (err) {
      setError(err.response?.data?.message || t("adminApprovals.approveFailed"));
    } finally {
      setActionInProgress("");
    }
  };

  const handleReject = async (workerId) => {
    try {
      setActionInProgress(workerId);
      setError("");
      await adminService.rejectWorker(workerId);
      setWorkers(workers.filter((w) => w._id !== workerId));
    } catch (err) {
      setError(err.response?.data?.message || t("adminApprovals.rejectFailed"));
    } finally {
      setActionInProgress("");
    }
  };

  return (
    <div className="page-content admin-page">
      <div className="page-header">
        <h1>👷 {t("adminApprovals.title")}</h1>
        <p>{t("adminApprovals.subtitle")}</p>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {loading ? (
        <div className="admin-loading">
          <span>⏳</span> {t("adminApprovals.loading")}
        </div>
      ) : workers.length === 0 ? (
        <div className="admin-empty">
          <p>{t("adminApprovals.noPending")}</p>
        </div>
      ) : (
        <div className="table-responsive admin-table">
          <table className="workers-table admin-home-table">
            <thead>
              <tr>
                <th>{t("common.fullName")}</th>
                <th>{t("common.email")}</th>
                <th>{t("adminApprovals.registeredAt")}</th>
                <th>{t("adminApprovals.action")}</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => (
                <tr key={worker._id}>
                  <td data-label={t("common.fullName")}>{worker.name}</td>
                  <td data-label={t("common.email")}>{worker.email}</td>
                  <td data-label={t("adminApprovals.registeredAt")}>
                    {new Date(worker.createdAt).toLocaleString()}
                  </td>
                  <td data-label={t("adminApprovals.action")}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleApprove(worker._id)}
                      disabled={actionInProgress === worker._id}
                      style={{ marginRight: 8 }}
                    >
                      {actionInProgress === worker._id ? t("adminApprovals.processing") : `✓ ${t("adminApprovals.approve")}`}
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleReject(worker._id)}
                      disabled={actionInProgress === worker._id}
                    >
                      {actionInProgress === worker._id ? t("adminApprovals.processing") : `✕ ${t("adminApprovals.reject")}`}
                    </button>
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

export default AdminApprovals;