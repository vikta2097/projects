import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Users from "../pages/Users";
import DashboardHome from "../pages/DashboardHome";
import Employees from "../pages/Employees";
import Attendance from "../pages/Attendance";
import LeaveManagement from "../pages/LeaveManagement";
import "../styles/AdminDashboardHome.css";

export default function AdminDashboard({ onLogout, role }) {
  const isAdmin = role === "admin";

  return (
    <div className="dashboard-container">
      <Sidebar onLogoutClick={onLogout} role={role} />
      <div className="dashboard-content">
        <Routes>
          {/* Shared routes */}
          <Route path="/" element={<DashboardHome />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/leave-management" element={<LeaveManagement />} />

          {/* Admin-only routes */}
          {isAdmin && <Route path="/employees" element={<Employees />} />}
          {isAdmin && <Route path="/users" element={<Users />} />}

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  );
}
