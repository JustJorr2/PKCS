import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminService } from "../../services/api";
import { useLanguage } from "../../context/LanguageContext";
import "../../styles/Admin/AdminPages.css";

const ROLE_META = {
  admin: { emoji: "🛡️" },
  supervisor: { emoji: "🧑‍💼" },
  worker: { emoji: "👷" }
};

const StatCard = ({ color, emoji, label, value }) => (
  <div className={`admin-stat-card ${color}`}>
    <span className="stat-emoji">{emoji}</span>
    <p className="stat-number">{value}</p>
    <h3>{label}</h3>
  </div>
);

function AdminHome() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [statsRes, usersRes] = await Promise.all([
          adminService.getDashboard(),
          adminService.getAllUsers()
        ]);
        setStats(statsRes.data);
        setUsers(usersRes.data || []);
      } catch (err) {
        console.error("Error fetching admin home data:", err);
        setError(t("adminHome.loadError"));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [t]);

  const recentUsers = useMemo(
    () =>
      [...users]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 6),
    [users]
  );

  if (loading) return <div className="admin-loading"><span>⏳</span> {t("adminHome.loading")}</div>;
  if (error) return <div className="admin-error">{error}</div>;

  return (
    <div className="page-content admin-page">
      <div className="page-header">
        <h1>🛡️ {t("adminHome.title")}</h1>
        <p>{t("adminHome.subtitle")}</p>
      </div>

      <div className="admin-stats-grid">
        <StatCard color="blue"   emoji="👥" label={t("adminHome.totalUsers")}    value={stats.totalUsers} />
        <StatCard color="purple" emoji="🧑‍💼" label={t("adminHome.supervisors")}   value={stats.supervisors} />
        <StatCard color="green"  emoji="👷" label={t("adminHome.workers")}        value={stats.workers} />
        <StatCard color="red"    emoji="🛡️" label={t("adminHome.admins")}         value={stats.admins} />
        <StatCard color="gold"   emoji="⭐" label={t("adminHome.avgWorkerRating")} value={Number(stats.avgRating || 0).toFixed(2)} />
      </div>

      <div className="admin-section">
        <h2 className="section-title">🆕 {t("adminHome.recentAccounts")}</h2>

        {recentUsers.length === 0 ? (
          <div className="admin-empty">{t("adminHome.noUsers")}</div>
        ) : (
          <div className="table-responsive admin-table">
            <table className="workers-table admin-home-table">
              <thead>
                <tr>
                  <th>{t("common.fullName")}</th>
                  <th>{t("common.email")}</th>
                  <th>{t("common.role")}</th>
                  <th>{t("adminHome.created")}</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u) => {
                  const meta = ROLE_META[u.role] ?? { emoji: "?" };
                  const roleLabel = t(`adminHome.role_${u.role}`) !== `adminHome.role_${u.role}`
                    ? t(`adminHome.role_${u.role}`)
                    : u.role;
                  return (
                    <tr key={u._id}>
                      <td data-label={t("common.fullName")} className="td-name clickable"
                        onClick={() => navigate(`/worker/${u._id}`)}
                        title={t("adminHome.viewProfile")}
                        style={{ cursor: "pointer" }}>
                        {u.name}
                      </td>
                      <td className="td-email" data-label={t("common.email")}>{u.email}</td>
                      <td data-label={t("common.role")}>
                        <span className={`admin-role admin-role-${u.role}`}>
                          {meta.emoji} {roleLabel}
                        </span>
                      </td>
                      <td data-label={t("adminHome.created")}>
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminHome;