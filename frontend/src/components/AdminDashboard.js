import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Users from "../pages/Users";
import DashboardHome from "../pages/DashboardHome";
import Employees from "../pages/Employees";
import Attendance from "../pages/Attendance";
import LeaveManagement from "../pages/LeaveManagement";
import Notifications from "../pages/Notifications";
import Messaging from "../EmployeeDashboard/messaging";
import AdminPayroll from "../pages/AdminPayroll"; // <-- ✅ ADD THIS IMPORT
import AnalyticsInsights from "../pages/AnalyticsInsights"; // Import the new Analytics Insights page

import "../styles/AdminDashboardHome.css";

export default function AdminDashboard({ onLogout, role }) {
  // Accept both admin and admin-employee as admins
  const isAdmin = role === "admin" || role === "admin-employee";

  const token = localStorage.getItem("token");
  let userId = null;
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      userId = payload.id;
    } catch (err) {
      console.error("Invalid token", err);
    }
  }

  return (
    <div className="dashboard-container">
      <Sidebar onLogoutClick={onLogout} role={role} />
      <div className="dashboard-content">
        <Routes>
          {/* Shared routes */}
          <Route path="/" element={<DashboardHome />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/leave-management" element={<LeaveManagement />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/messages" element={<Messaging userId={userId} />} />

          {/* Admin-only routes */}
          {isAdmin && <Route path="/employees" element={<Employees />} />}
          {isAdmin && <Route path="/payroll" element={<AdminPayroll />} />} {/* ✅ Payroll Route */}
          {isAdmin && <Route path="/users" element={<Users />} />}

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" />} />
           <Route path="/analytics" element={<AnalyticsInsights />} />
        </Routes>
      </div>
    </div>
  );
}
