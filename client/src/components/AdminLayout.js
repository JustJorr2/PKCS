import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AdminNav from "./AdminNav";
import AdminHome from "../pages/Admin/AdminHome";
import AdminUsers from "../pages/Admin/AdminUsers";
import AdminData from "../pages/Admin/AdminData";
import AdminDataTools from "../pages/Admin/AdminDataTools";
import AdminRatingEditRequests from "../pages/Admin/AdminRatingEditRequests";
import AdminProfile from "../pages/Admin/AdminProfile";
import WorkerInformation from "../components/common/WorkerInformation";
import "../styles/Supervisor/SupervisorLayout.css";
import "../styles/Admin/AdminPages.css";

function AdminLayout({ worker, onLogout, onProfileUpdated }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="supervisor-layout">
      {/* Sidebar */}
      <AdminNav
        worker={worker}
        userName={worker?.name || "Admin"}
        onLogout={onLogout}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      {/* Main Content */}
      <div className={`main-content ${collapsed ? "collapsed" : ""}`}>
        <Routes>
          {/* Home */}
          <Route path="/" element={<AdminHome />} />

          {/* Users */}
          <Route path="/users" element={<AdminUsers />} />
          <Route path="/worker/:id" element={<WorkerInformation />} />

          {/* Data */}
          <Route path="/data" element={<AdminData worker={worker} />} />

          {/* Data Tools */}
          <Route path="/tools" element={<AdminDataTools />} />

          {/* Rating Edit Requests & Worker Approvals */}
          <Route path="/edit-requests" element={<AdminRatingEditRequests />} />

          {/* Profile */}
          <Route path="/profile" element={<AdminProfile worker={worker} onLogout={onLogout} onProfileUpdated={onProfileUpdated} />} />

          {/* Default */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  );
}

export default AdminLayout;
