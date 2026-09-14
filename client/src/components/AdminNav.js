import "../styles/Supervisor/SupervisorNav.css";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { config } from "../config/config";
import { adminService } from "../services/api";

function AdminNav({
  worker,
  userName,
  onLogout,
  collapsed,
  setCollapsed
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  useEffect(() => {
    let isActive = true;

    const fetchPendingRequestCount = async () => {
      try {
        const [editRequests, workerApprovals, lateSubmissions] = await Promise.all([
          adminService.getPendingRatingEditRequests(),
          adminService.getPendingWorkerApprovals(),
          adminService.getPendingLateSubmissionRequests()
        ]);

        if (isActive) {
          setPendingRequestCount(
            (editRequests.data?.length || 0) +
            (workerApprovals.data?.length || 0) +
            (lateSubmissions.data?.length || 0)
          );
        }
      } catch {
        if (isActive) setPendingRequestCount(0);
      }
    };

    fetchPendingRequestCount();
    const intervalId = window.setInterval(fetchPendingRequestCount, 30000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const pages = [
    { id: "home", label: t("adminNav.home"), icon: "\u{1F3E0}", path: "/" },
    { id: "users", label: t("adminNav.manageUsers"), icon: "\u{1F465}", path: "/users" },
    { id: "data", label: t("adminNav.dataVisuals"), icon: "\u{1F4CA}", path: "/data" },
    { id: "tools", label: t("adminNav.dataTools"), icon: "\u{1F527}", path: "/tools" },
    { id: "edit-requests", label: t("adminNav.editRequests"), icon: "\u{1F4E8}", path: "/edit-requests" },
    { id: "profile", label: t("adminNav.profile"), icon: "\u{1F464}", path: "/profile" }
  ];

  const isActive = (path) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.includes(path)) return true;
    return false;
  };

  return (
    <nav className={`supervisor-nav ${collapsed ? "collapsed" : ""}`}>
      <div className="nav-container">
        <button
          className="toggle-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? t("adminNav.expand") : t("adminNav.collapse")}
        >
          {collapsed ? "»" : "«"}
        </button>

        <div className="nav-brand">
          <img src="/PGE_Logo.png" alt="Logo" className="nav-logo" />
        </div>

        <div className="nav-menu">
          <div className="nav-pages">
            {pages.map((page) => (
              <button
                key={page.id}
                className={`nav-item ${isActive(page.path) ? "active" : ""}`}
                onClick={() => navigate(page.path)}
                title={page.label}
              >
                <span className="nav-icon">{page.icon}</span>
                {!collapsed && <span className="nav-label">{page.label}</span>}
                {page.id === "edit-requests" && pendingRequestCount > 0 && (
                  <span className="nav-badge">{pendingRequestCount}</span>
                )}
              </button>
            ))}
          </div>

          <div className="nav-worker">
            <div className="worker-info">
              {worker?.profilePicture ? (
                <img
                  src={`${config.API_BASE_URL}/${worker.profilePicture}`}
                  alt="Profile"
                  className="worker-avatar worker-avatar-image"
                />
              ) : (
                <div className="worker-avatar">{userName?.charAt(0)?.toUpperCase()}</div>
              )}
              {!collapsed && <span className="worker-name">{userName}</span>}
            </div>

            {!collapsed && (
              <button className="logout-btn" onClick={onLogout}>
                {t("adminNav.logout")}
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default AdminNav;
