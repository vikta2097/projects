import React, { useState } from "react";
import AdminDashboard from "./AdminDashboard";
import UserDashboard from "../EmployeeDashboard/UserDashboard";
import Sidebar from "../components/Sidebar"; // Ensure you have a Sidebar component
//import "../styles/DualDashboard.css"; // optional for layout styling

export default function DualDashboardView({ token, onLogout }) {
  const [activeView, setActiveView] = useState("admin"); // 'admin' or 'employee'

  // Button styles for toggler
  const buttonStyle = (active) => ({
    padding: "6px 12px",
    cursor: active ? "default" : "pointer",
    backgroundColor: active ? "#1976d2" : "#e0e0e0",
    color: active ? "white" : "black",
    border: "none",
    borderRadius: "4px",
  });

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Dashboard switch toggle */}
      <div
        style={{
          padding: "10px",
          backgroundColor: "#f5f5f5",
          display: "flex",
          justifyContent: "center",
          gap: "10px",
          borderBottom: "1px solid #ccc",
        }}
      >
        <button
          onClick={() => setActiveView("admin")}
          disabled={activeView === "admin"}
          style={buttonStyle(activeView === "admin")}
        >
          Admin Dashboard
        </button>
        <button
          onClick={() => setActiveView("employee")}
          disabled={activeView === "employee"}
          style={buttonStyle(activeView === "employee")}
        >
          Employee View
        </button>
      </div>

      {/* Dashboard Layout */}
      <div style={{ flex: 1, display: "flex" }}>
        {/* Sidebar only for Admin view */}
        {activeView === "admin" && (
          <Sidebar
            role="admin"
            onLogout={onLogout}
          />
        )}

        {/* Main content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {activeView === "admin" ? (
            <AdminDashboard token={token} role="admin" />
          ) : (
            <UserDashboard token={token} role="employee" />
          )}
        </div>
      </div>
    </div>
  );
}
