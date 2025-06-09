import React, { useEffect, useState } from "react";
import "../styles/DashboardHome.css";

const DashboardHome = () => {
  const [stats, setStats] = useState({
    employees: 0,
    pendingLeaves: 0,
    presentToday: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
  try {
    const token = localStorage.getItem('token');

    const [empRes, leaveRes, attRes] = await Promise.all([
      fetch('/api/employees', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/leaves?status=pending', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/attendance/today', { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    const employees = await empRes.json();
    const pendingLeaves = await leaveRes.json();
    const presentToday = await attRes.json();

    console.log('employees:', employees);
    console.log('pendingLeaves:', pendingLeaves);
    console.log('presentToday:', presentToday);

   setStats({
  employees: Array.isArray(employees) ? employees.length : 0,
  pendingLeaves: Array.isArray(pendingLeaves) ? pendingLeaves.length : 0,
  presentToday: Array.isArray(presentToday) ? presentToday.length : presentToday.count || 0,
});

  } catch (err) {
    console.error('Failed to load dashboard stats:', err);
  }
};

    fetchStats();
  }, []);

  return (
    <div className="dashboard-home">
      <h1>Welcome to the Employee Management System</h1>
      <p>Use the sidebar to navigate through employee records, attendance logs, and leave requests.</p>

      <div className="dashboard-stats">
        <div className="stat-card">
          <h2>{stats.employees}</h2>
          <p>Employees</p>
        </div>
        <div className="stat-card">
          <h2>{stats.pendingLeaves}</h2>
          <p>Pending Leave Requests</p>
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
