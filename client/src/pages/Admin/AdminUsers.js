import { useEffect, useMemo, useState } from "react";
import { adminService } from "../../services/api";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { config } from "../../config/config";
import "../../styles/Admin/AdminPages.css";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import FeedbackDialog from "../../components/common/FeedbackDialog";
import { BarChart3, LoaderCircle, ShieldCheck, UserCog, UserRound, Users, X } from "lucide-react";

const WORKER_AREAS = ["Komperta", "Kantor", "Rudis GM", "CCR 1-4", "PLTP 5&6"];

function AdminUsers() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const ROLES = [
    { value: "worker", label: t("adminUsers.roleWorker") },
    { value: "supervisor", label: t("adminUsers.roleSupervisor") },
    { value: "admin", label: t("adminUsers.roleAdmin") }
  ];

const FILTER_TABS = [
  { key: "all", label: t("adminUsers.filterAll"), icon: BarChart3 },
  { key: "worker", label: t("adminUsers.filterWorkers"), icon: UserRound },
  { key: "supervisor", label: t("adminUsers.filterSupervisors"), icon: UserCog },
  { key: "admin", label: t("adminUsers.filterAdmins"), icon: ShieldCheck }
];

  const EMPTY_FORM = { name: "", email: "", username: "", password: "", role: "worker" };

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearch] = useState("");
  const [filterRole, setFilter] = useState("all");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [passwordModal, setPasswordModal] = useState({ isOpen: false, userId: null, newPassword: "" });
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ isOpen: false, title: "", message: "", type: "error" });
  const [deleteUserId, setDeleteUserId] = useState(null);

  const getAdminErrorMessage = (err, fallback) => {
    const message = err.response?.data?.message;
    const messageKeys = {
      "This user has no email and cannot become a supervisor or admin. Add an email first.": "adminUsers.missingEmail",
      "This user has no username and cannot become a worker. Add a username first.": "adminUsers.missingUsername",
      "Invalid worker area": "adminUsers.invalidArea",
      "Areas can only be assigned to workers": "adminUsers.workerAreaOnly"
    };

    return messageKeys[message] ? t(messageKeys[message]) : (message || fallback);
  };

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await adminService.getAllUsers();
      setUsers(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (id, role) => {
    try {
      await adminService.updateUserRole(id, role);
      fetchUsers();
    } catch (err) {
      setFeedback({ isOpen: true, title: t("common.error"), message: getAdminErrorMessage(err, t("adminUsers.roleUpdateFailed")), type: "error" });
    }
  };

  const handleAreaChange = async (id, area) => {
    try {
      await adminService.updateWorkerArea(id, area || null);
      fetchUsers();
    } catch (err) {
      setFeedback({ isOpen: true, title: t("common.error"), message: getAdminErrorMessage(err, t("adminUsers.areaUpdateFailed")), type: "error" });
    }
  };

  const handleDelete = async (id) => {
    setDeleteUserId(id);
  };

  const confirmDelete = async () => {
    try {
      await adminService.deleteUser(deleteUserId);
      setDeleteUserId(null);
      fetchUsers();
    } catch (err) {
      setDeleteUserId(null);
      setFeedback({ isOpen: true, title: t("common.error"), message: getAdminErrorMessage(err, t("adminUsers.deleteFailed")), type: "error" });
    }
  };

  const handlePasswordReset = (id) => {
    setPasswordModal({ isOpen: true, userId: id, newPassword: "" });
  };

  const handleSubmitPasswordReset = async () => {
    if (!passwordModal.newPassword.trim()) return;
    try {
      setPasswordSubmitting(true);
      await adminService.changePassword(passwordModal.userId, passwordModal.newPassword);
      setPasswordModal({ isOpen: false, userId: null, newPassword: "" });
      fetchUsers();
    } catch (err) {
      setFeedback({ isOpen: true, title: t("common.error"), message: getAdminErrorMessage(err, t("adminUsers.passwordUpdateFailed")), type: "error" });
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleClosePasswordModal = () => {
    setPasswordModal({ isOpen: false, userId: null, newPassword: "" });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await adminService.createUser(form);
      setForm(EMPTY_FORM);
      fetchUsers();
    } finally {
      setSubmitting(false);
    }
  };

  const setField = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const filteredUsers = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return users.filter((u) => {
      const roleMatch = filterRole === "all" || u.role === filterRole;
      const searchMatch =
        u.name.toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.username || "").toLowerCase().includes(q);
      return roleMatch && searchMatch;
    });
  }, [users, searchTerm, filterRole]);

  const roleCounts = useMemo(() => ({
    all: users.length,
    worker: users.filter((u) => u.role === "worker").length,
    supervisor: users.filter((u) => u.role === "supervisor").length,
    admin: users.filter((u) => u.role === "admin").length
  }), [users]);

  return (
    <div className="page-content admin-page">
      <FeedbackDialog {...feedback} closeText={t("common.close")} onClose={() => setFeedback((prev) => ({ ...prev, isOpen: false }))} />
      <ConfirmDialog
        isOpen={Boolean(deleteUserId)}
        title={t("adminUsers.confirmDeleteTitle")}
        message={t("adminUsers.confirmDelete")}
        confirmText={t("adminUsers.delete")}
        cancelText={t("common.cancel")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteUserId(null)}
      />
      {/* Password Reset Modal */}
      {passwordModal.isOpen && (
        <div className="modal-overlay" onClick={handleClosePasswordModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t("adminUsers.resetPasswordTitle")}</h3>
              <button className="modal-close" onClick={handleClosePasswordModal} aria-label={t("common.cancel")}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>
                {t("adminUsers.resetPasswordLabel")}
              </label>
              <input
                type="password"
                value={passwordModal.newPassword}
                onChange={(e) => setPasswordModal({ ...passwordModal, newPassword: e.target.value })}
                placeholder={t("adminUsers.newPasswordPlaceholder")}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontFamily: "inherit",
                  fontSize: "14px",
                  boxSizing: "border-box"
                }}
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={handleSubmitPasswordReset}
                disabled={passwordSubmitting || !passwordModal.newPassword.trim()}
              >
                {passwordSubmitting ? t("adminUsers.updating") : t("adminUsers.updatePassword")}
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleClosePasswordModal}
                disabled={passwordSubmitting}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1><Users size={28} aria-hidden="true" /> {t("adminUsers.title")}</h1>
        <p>{t("adminUsers.subtitle")}</p>
      </div>

      <div className="admin-section admin-card">
        <h2 className="section-title">{t("adminUsers.addNewUser")}</h2>
        <form className="admin-form-row" onSubmit={handleCreateUser}>
          <input className="admin-input" placeholder={t("common.fullName")} value={form.name} onChange={setField("name")} required />
          <input
            className="admin-input"
            placeholder={t("common.username")}
            value={form.username}
            onChange={setField("username")}
            required={form.role === "worker"}
          />
          <input
            className="admin-input"
            type="email"
            placeholder={form.role === "worker" ? `${t("common.email")} (${t("common.optional")})` : t("common.email")}
            value={form.email}
            onChange={setField("email")}
            required={form.role !== "worker"}
          />
          <input className="admin-input" type="password" placeholder={t("login.password")} value={form.password} onChange={setField("password")} required />
          <select className="admin-select" value={form.role} onChange={setField("role")}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button className="admin-btn primary" type="submit" disabled={submitting}>
            {submitting ? t("adminUsers.creating") : t("adminUsers.createUser")}
          </button>
        </form>
      </div>

      <div className="admin-section admin-card">
        <h2 className="section-title">{t("adminUsers.userDirectory")}</h2>

        <div className="admin-toolbar">
          <input
            type="text"
            placeholder={t("adminUsers.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearch(e.target.value)}
            className="admin-input admin-search"
          />
          <div className="filter-tabs">
            {FILTER_TABS.map((tab) => (
              <button key={tab.key} className={`filter-tab ${filterRole === tab.key ? "active" : ""}`} onClick={() => setFilter(tab.key)}>
                <tab.icon size={15} aria-hidden="true" /> {tab.label}
                <span className="tab-count">{roleCounts[tab.key]}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="admin-loading"><LoaderCircle className="spin" size={18} aria-hidden="true" /> {t("adminUsers.loadingUsers")}</div>
        ) : filteredUsers.length === 0 ? (
          <div className="admin-empty">{t("adminUsers.noUsersMatch")}</div>
        ) : (
          <div className="table-responsive admin-table">
            <table className="workers-table admin-users-table">
              <thead>
                <tr>
                  <th>{t("common.fullName")}</th>
                  <th>{t("common.username")}</th>
                  <th>{t("common.email")}</th>
                  <th>{t("common.role")}</th>
                  <th>{t("adminUsers.area")}</th>
                  <th>{t("adminHome.created")}</th>
                  <th>{t("adminUsers.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u._id}>
                    <td data-label={t("common.fullName")} className="td-name clickable"
                      onClick={() => navigate(`/worker/${u._id}`)}
                      title={t("adminHome.viewProfile")}
                      style={{ cursor: "pointer" }}>
                      <div className="worker-name-cell">
                        {u.profilePicture ? (
                          <img
                            src={`${config.API_BASE_URL}/${u.profilePicture}`}
                            alt={u.name}
                            className="worker-badge worker-badge-image"
                          />
                        ) : (
                          <div className="worker-badge">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {u.name}
                      </div>
                    </td>
                    <td data-label={t("common.username")}>{u.username || "—"}</td>
                    <td className="td-email" data-label={t("common.email")}>{u.email || "—"}</td>
                    <td data-label={t("common.role")}>
                      <select className="admin-select admin-select-inline" value={u.role} onChange={(e) => handleRoleChange(u._id, e.target.value)}>
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </td>
                    <td data-label={t("adminUsers.area")}>
                      {u.role === "worker" ? (
                        <select
                          className="admin-select admin-select-inline"
                          value={u.area || ""}
                          onChange={(e) => handleAreaChange(u._id, e.target.value)}
                        >
                          <option value="">{t("adminUsers.unassigned")}</option>
                          {WORKER_AREAS.map((area) => <option key={area} value={area}>{area}</option>)}
                        </select>
                      ) : <span>-</span>}
                    </td>
                    <td data-label={t("adminHome.created")}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}</td>
                    <td data-label={t("adminUsers.actions")}>
                      <div className="admin-table-actions">
                        <button className="admin-btn warning" onClick={() => handlePasswordReset(u._id)} title={t("adminUsers.resetPassword")}>
                          {t("adminUsers.reset")}
                        </button>
                        <button className="admin-btn danger" onClick={() => handleDelete(u._id)} title={t("adminUsers.deleteUser")}>
                          {t("adminUsers.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminUsers;