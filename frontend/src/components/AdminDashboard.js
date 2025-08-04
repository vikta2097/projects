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
import AdminPayroll from "../pages/AdminPayroll";
import AnalyticsInsights from "../pages/AnalyticsInsights";
import BroadcastTicker from "../pages/BroadcastTicker";
import "../styles/AdminDashboardHome.css";

import { useOnlineStatus } from "../components/OnlineStatusContext";

export default function AdminDashboard({ onLogout, role }) {
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

  const { onlineUsers } = useOnlineStatus();
  const onlineList = Array.from(onlineUsers);

  return (
    <div className="dashboard-container">
      <Sidebar onLogoutClick={onLogout} role={role} />
      <div className="dashboard-content">
        <BroadcastTicker />

        {/* ✅ Display online users for admin */}
        <div style={{ fontSize: "14px", marginBottom: "10px", color: "green" }}>
          ✅ Online Users: {onlineList.length > 0 ? onlineList.join(", ") : "None"}
        </div>

        <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/leave-management" element={<LeaveManagement />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/messages" element={<Messaging userId={userId} />} />
          {isAdmin && <Route path="/employees" element={<Employees />} />}
          {isAdmin && <Route path="/payroll" element={<AdminPayroll />} />}
          {isAdmin && <Route path="/users" element={<Users />} />}
          {isAdmin && <Route path="/analytics" element={<AnalyticsInsights />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  );
}
