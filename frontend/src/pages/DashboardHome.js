import React, { useEffect, useState } from "react";
import "../styles/AdminDashboardHome.css";
import NotificationComponent from "../pages/Notifications";

const DashboardHome = () => {
  const [stats, setStats] = useState({ employees: 0, pendingLeaves: 0, presentToday: 0 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

    const getUserIdFromToken = () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return null;
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.id || payload.userId || payload.sub;
      } catch (err) {
        console.error("Failed to decode token", err);
        return null;
      }
    };


  useEffect(() => {
    const uid = getUserIdFromToken();
    if (uid) setUserId(uid);
    console.log("🧪 Admin dashboard userId:", uid);


    const token = localStorage.getItem("token");
    if (!token) {
      setError("No authentication token.");
      return;
    }

    const fetchStats = async () => {
      setLoading(true);
      try {
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

        const employees = await empRes.json();
        const allLeaves = await leaveRes.json();
        const presentToday = await attRes.json();

        const pendingLeaves = allLeaves.filter((leave) => leave.status === "pending");

        setStats({
          employees: employees.length,
          pendingLeaves: pendingLeaves.length,
          presentToday: presentToday.length,
        });
      } catch (err) {
        console.error("Error loading stats:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return <div>Loading dashboard stats...</div>;

  return (
    <div>
      {/* ✅ Correct userId passed to NotificationComponent */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
        {userId && <NotificationComponent userId={userId} />}
      </div>

      <div className="admin-dashboard-home">
        <h1>Welcome to the Employee Management System</h1>
        <p>View key metrics and track workplace activity.</p>

        {error && <div className="error-message">⚡ {error}</div>}

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
    </div>
  );
};

export default DashboardHome;
