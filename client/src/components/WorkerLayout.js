import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import WorkerHome from "../pages/User/WorkerHome";
import WorkerRatings from "../pages/User/WorkerRatings";
import WorkerNav from "../pages/User/WorkerNavigation";
import WorkerFeedback from "../pages/User/WorkerFeedback";
import WorkerProfile from "../pages/User/WorkerProfile";

function WorkerLayout({ worker, onLogout, onProfileUpdated }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="supervisor-layout">
      {/* Reuse same layout class */}

      <WorkerNav
        worker={worker}
        userName={worker?.name || "Worker"}
        onLogout={onLogout}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      <div className={`main-content ${collapsed ? "collapsed" : ""}`}>
        <Routes>
          <Route path="/" element={<WorkerHome worker={worker} />} />
          <Route path="/ratings" element={<WorkerRatings worker={worker} />} />
          <Route path="/feedback" element={<WorkerFeedback worker={worker} />} />
          <Route path="/profile" element={<WorkerProfile worker={worker} onLogout={onLogout} onProfileUpdated={onProfileUpdated} />} />
          <Route path="/worker/:id" element={<Navigate to="/worker/ratings" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  );
}

export default WorkerLayout;
