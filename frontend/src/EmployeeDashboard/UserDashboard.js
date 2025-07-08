import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Notifications from '../pages/Notifications';

import EmployeeSidebar from "./EmployeeSidebar";
import EmployeeDashboardHome from "./EmployeeDashboardHome";
import LeaveForm from "./LeaveForm";

import "../styles/EmployeeDashboardHome.css";
import MyAttendance from "./MyAttendance";
import EmployeeProfile from "./EmployeeProfile";

export default function UserDashboard({ onLogout, role }) {
  return (
    <div className="dashboard-container">
      <EmployeeSidebar onLogoutClick={onLogout} role={role} />

      <div className="dashboard-content">
        <Routes>
          <Route path="/" element={<EmployeeDashboardHome />} />
          <Route path="/leave-management" element={<LeaveForm />} />
          <Route path="*" element={<Navigate to="/" />} />
          <Route path="/Attendance" element={<MyAttendance />} />
          <Route path="/Profile" element={<EmployeeProfile />} />
          <Route path="/notifications" element={<Notifications />} />
        </Routes>
      </div>
    </div>
  );
}
