import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import AuthForm from "./components/AuthForm";
import DualDashboardView from "./components/DualDashboardView"; // import the toggle wrapper
import UserDashboard from "./EmployeeDashboard/UserDashboard";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedRole = localStorage.getItem("role");
    if (storedToken && storedRole) {
      setIsAuthenticated(true);
      setUserRole(storedRole);
      setToken(storedToken);
    }
  }, []);

  const handleLogin = ({ token, role }) => {
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    setIsAuthenticated(true);
    setUserRole(role);
    setToken(token);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setIsAuthenticated(false);
    setUserRole(null);
    setToken(null);
  };

  return (
    <Router>
      <Routes>
        {/* Public Route */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <AuthForm onLoginSuccess={handleLogin} />
            )
          }
        />

        {/* Protected Route */}
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              userRole === "admin" || userRole === "admin-employee" ? (
                <DualDashboardView token={token} onLogout={handleLogout} />
              ) : (
                <UserDashboard role={userRole} token={token} onLogout={handleLogout} />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
