import React, { useEffect, useState } from "react";
import "../styles/AdminDashboardHome.css";

const DashboardHome = () => {
  const [stats, setStats] = useState({ employees: 0, pendingLeaves: 0, presentToday: 0 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const checkResponse = async (response) => {
    const text = await response.text();

    if (!response.ok) {
      try {
        const data = JSON.parse(text);
        throw new Error(data.message || "Failed to fetch data");
      } catch {
        throw new Error(text || "Failed to fetch data");
      }
    }

    return JSON.parse(text);
  };

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          setError("No authentication token.");
          setLoading(false);
          return;
        }

        // Perform requests in parallel
        const [empRes, leaveRes, attRes] = await Promise.all([
          fetch('http://localhost:3300/api/employees', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('http://localhost:3300/api/leaves', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('http://localhost:3300/api/attendance/today', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const employees = await checkResponse(empRes);
        const allLeaves = await checkResponse(leaveRes);
        const presentToday = await checkResponse(attRes);

        const pendingLeaves = allLeaves.filter((leave) => leave.status === "pending");

        setStats({
          employees: Array.isArray(employees) ? employees.length : 0,
          pendingLeaves: pendingLeaves.length,
          presentToday: Array.isArray(presentToday) ? presentToday.length : 0,
        });

      } catch (err) {
        setError(err.message);
        console.error("Failed to load dashboard stats.", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div>Loading dashboard stats...</div>;
  }

  return (
    <div className="admin-dashboard-home">
      <h1>Welcome to the Employee Management System</h1>
      <p>View key metrics and track workplace activity.</p>

      {error && (
        <div className="error-message" style={{ color: "red", marginBottom: "1rem" }}>
          ⚡ {error}
        </div>
      )}

      <div className="dashboard-stats">
        <div className="stat-card">
          <h2>{stats.employees}</h2>
          <p>Employees</p>
        </div>
        <div className="stat-card">
          <h2>{stats.pendingLeaves}</h2>
          <p>Pending Leaves</p>
        </div>
        <div className="stat-card">
          <h2>{stats.presentToday}</h2>
          <p>Present Today</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
