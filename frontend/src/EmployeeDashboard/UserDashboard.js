import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Notifications from "../pages/Notifications";

import EmployeeSidebar from "./EmployeeSidebar";
import EmployeeDashboardHome from "./EmployeeDashboardHome";
import LeaveForm from "./LeaveForm";
import Messaging from "./messaging";
import MyAttendance from "./MyAttendance";
import EmployeeProfile from "./EmployeeProfile";
import EmployeePayslips from "./EmployeePayslips"; // ✅ Import this

import "../styles/EmployeeDashboardHome.css";

export default function UserDashboard({ onLogout, role }) {
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
      <EmployeeSidebar onLogoutClick={onLogout} role={role} />
      <div className="dashboard-content">
        <Routes>
          <Route path="/" element={<EmployeeDashboardHome />} />
          <Route path="/leave-management" element={<LeaveForm />} />
          <Route path="/attendance" element={<MyAttendance />} />
          <Route path="/profile" element={<EmployeeProfile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/messages" element={<Messaging userId={userId} />} />
          <Route path="/payslips" element={<EmployeePayslips />} /> {/* ✅ New Route */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  );
}
