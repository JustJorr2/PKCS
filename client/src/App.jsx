import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import "./styles/App.css";

import LoginPage from "./pages/LoginPage";
import SupervisorLayout from "./components/SupervisorLayout";
import WorkerLayout from "./components/WorkerLayout";
import AdminLayout from "./components/AdminLayout";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";

function AppContent() {
  const [worker, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const savedUser = localStorage.getItem("worker");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    localStorage.setItem("worker", JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("worker");
    setUser(null);
  };

  const handleProfileUpdated = (updatedUser) => {
    const mergedUser = { ...worker, ...updatedUser };
    localStorage.setItem("worker", JSON.stringify(mergedUser));
    setUser(mergedUser);
  };

  if (loading) {
    return <div className="loading-screen">{t("common.loading")}</div>;
  }

  if (!worker) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <Routes>

      {/* ROLE-BASED LAYOUT */}
      {worker.role === "supervisor" && (
        <Route
          path="/*"
          element={<SupervisorLayout worker={worker} onLogout={handleLogout} onProfileUpdated={handleProfileUpdated} />}
        />
      )}

      {worker.role === "admin" && (
        <Route
          path="/*"
          element={<AdminLayout worker={worker} onLogout={handleLogout} onProfileUpdated={handleProfileUpdated} />}
        />
      )}

      {worker.role === "worker" && (
        <Route
          path="/*"
          element={<WorkerLayout worker={worker} onLogout={handleLogout} onProfileUpdated={handleProfileUpdated} />}
        />
      )}

      {/* fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
