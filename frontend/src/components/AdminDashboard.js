import React from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Users from "../pages/Users";
import DashboardHome from "../pages/DashboardHome";
import Employees from "../pages/Employees";
import Attendance from "../pages/Attendance";
import LeaveManagement from "../pages/LeaveManagement";
import "../styles/DashboardHome.css";

export default function AdminDashboard({ onLogout }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    onLogout();
    navigate("/login");
  };

  return (
    <div className="dashboard-container">
      <Sidebar onLogoutClick={handleLogout} />
      <div className="dashboard-content">
        <Routes>
          <Route path="/users" element={<Users />} />
          <Route path="/" element={<DashboardHome onLogout={onLogout} />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/leave-management" element={<LeaveManagement />} />
        </Routes>
      </div>
    </div>
  );
}
