import React from "react";
import { NavLink } from "react-router-dom";
import "../styles/EmployeeSidebar.css";

export default function EmployeeSidebar({ onLogoutClick, role }) {
  return (
    <div className="sidebar">
      <h2 className="sidebar-title">Employee Dashboard</h2>

      <nav className="sidebar-menu">
        <NavLink to="/" className={({ isActive }) => (isActive ? "active" : "")}>
          Dashboard
        </NavLink>

        <NavLink to="/attendance" className={({ isActive }) => (isActive ? "active" : "")}>
          Attendance
        </NavLink>

        <NavLink to="/leave-management" className={({ isActive }) => (isActive ? "active" : "")}>
          Apply for Leave
        </NavLink>

        <NavLink to="/payslips" className={({ isActive }) => (isActive ? "active" : "")}>
          Payslips
        </NavLink>

        <NavLink to="/profile" className={({ isActive }) => (isActive ? "active" : "")}>
          Profile
        </NavLink>

        <NavLink to="/messages" className={({ isActive }) => (isActive ? "active" : "")}>
          Messages
        </NavLink>

        <button className="logout-btn" onClick={onLogoutClick}>
          Logout
        </button>
      </nav>
    </div>
  );
}
