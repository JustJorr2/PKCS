import "../styles/Supervisor/SupervisorNav.css";
import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { config } from "../config/config";

function SupervisorNav({ worker, userName, onLogout, collapsed, setCollapsed }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const pages = [
    { id: "home", label: t("supervisorNav.home"), icon: "\uD83C\uDFE0", path: "/" },
    { id: "details", label: t("supervisorNav.details"), icon: "\uD83D\uDC65", path: "/details" },
    { id: "visuals", label: t("supervisorNav.dataVisuals"), icon: "\uD83D\uDCCA", path: "/visuals" },
    { id: "profile", label: t("supervisorNav.profile"), icon: "\uD83D\uDC64", path: "/profile" }
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
          title={collapsed ? t("supervisorNav.expand") : t("supervisorNav.collapse")}
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
                {t("supervisorNav.logout")}
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default SupervisorNav;
