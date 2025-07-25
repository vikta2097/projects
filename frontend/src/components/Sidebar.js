import React from "react";
import { NavLink } from "react-router-dom";
import "../styles/Sidebar.css";

const Sidebar = ({ onLogoutClick, role }) => {
  const isAdmin = role === "admin";

  return (
    <div className="sidebar">
      <h2 className="sidebar-title">EMS Dashboard</h2>

      <div className="sidebar-menu">
        <NavLink
          to="/"
          className={({ isActive }) =>
            isActive ? "sidebar-link active" : "sidebar-link"
          }
        >
          Home
        </NavLink>

        {isAdmin && (
          <>
            <NavLink
              to="/employees"
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              Employees
            </NavLink>

            <NavLink
              to="/payroll"
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              Payroll
            </NavLink>

            <NavLink
              to="/users"
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              Users
            </NavLink>
          </>
        )}

        <NavLink
          to="/attendance"
          className={({ isActive }) =>
            isActive ? "sidebar-link active" : "sidebar-link"
          }
        >
          Attendance
        </NavLink>

        <NavLink
          to="/leave-management"
          className={({ isActive }) =>
            isActive ? "sidebar-link active" : "sidebar-link"
          }
        >
          Leave
        </NavLink>

        <NavLink
          to="/messages"
          className={({ isActive }) =>
            isActive ? "sidebar-link active" : "sidebar-link"
          }
        >
          Messaging
        </NavLink>

        <NavLink
  to="/analytics"
  className={({ isActive }) =>
    isActive ? "sidebar-link active" : "sidebar-link"
  }
>
  AI Insights
</NavLink>

        <button onClick={onLogoutClick} className="logout-btn">
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
