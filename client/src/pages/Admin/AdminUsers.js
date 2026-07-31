import { useEffect, useMemo, useState } from "react";
import { adminService } from "../../services/api";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { config } from "../../config/config";
import "../../styles/Admin/AdminPages.css";

function AdminUsers() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const ROLES = [
    { value: "worker", label: t("adminUsers.roleWorker"), emoji: "👷" },
    { value: "supervisor", label: t("adminUsers.roleSupervisor"), emoji: "🧑‍💼" },
    { value: "admin", label: t("adminUsers.roleAdmin"), emoji: "🛡️" }
  ];

  const FILTER_TABS = [
    { key: "all", label: t("adminUsers.filterAll"), emoji: "📊" },
    { key: "worker", label: t("adminUsers.filterWorkers"), emoji: "👷" },
    { key: "supervisor", label: t("adminUsers.filterSupervisors"), emoji: "🧑‍💼" },
    { key: "admin", label: t("adminUsers.filterAdmins"), emoji: "🛡️" }
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
      alert(err.response?.data?.message || t("adminUsers.roleUpdateFailed"));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t("adminUsers.confirmDelete"))) return;
    await adminService.deleteUser(id);
    fetchUsers();
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
      alert(err.response?.data?.message || t("adminUsers.passwordUpdateFailed"));
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
      {/* Password Reset Modal */}
      {passwordModal.isOpen && (
        <div className="modal-overlay" onClick={handleClosePasswordModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t("adminUsers.resetPasswordTitle")}</h3>
              <button className="modal-close" onClick={handleClosePasswordModal}>×</button>
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
        <h1>👥 {t("adminUsers.title")}</h1>
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
              <option key={r.value} value={r.value}>{r.emoji} {r.label}</option>
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
                {tab.emoji} {tab.label}
                <span className="tab-count">{roleCounts[tab.key]}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="admin-loading"><span>⏳</span> {t("adminUsers.loadingUsers")}</div>
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
                          <option key={r.value} value={r.value}>{r.emoji} {r.label}</option>
                        ))}
                      </select>
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