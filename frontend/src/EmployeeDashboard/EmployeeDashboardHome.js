import React, { useEffect, useState } from "react";
import "../styles/EmployeeDashboardHome.css";

export default function EmployeeDashboardHome() {
  const [leaveStatus, setLeaveStatus] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [stats, setStats] = useState({ pendingLeaves: 0, presentToday: 0 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // ✅ FIXED checkResponse to avoid "body stream already read" error
  const checkResponse = async (response) => {
    try {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch data");
      }
      return data;
    } catch (err) {
      throw new Error("Failed to parse response");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("No authentication token.");
          setLoading(false);
          return;
        }

        // Fetch leaves and attendance
        const [leavesRes, attendanceRes] = await Promise.all([
          fetch("http://localhost:3300/api/leaves/mine", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("http://localhost:3300/api/attendance/mine/recent", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const leavesData = await checkResponse(leavesRes);
        const attendanceData = await checkResponse(attendanceRes);
        setLeaveStatus(leavesData);
        setAttendance(attendanceData);

        // Fetch overall stats
        const [allLeavesRes, presentTodayRes] = await Promise.all([
          fetch("http://localhost:3300/api/leaves", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("http://localhost:3300/api/attendance/today", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const allLeaves = await checkResponse(allLeavesRes);
        const presentToday = await checkResponse(presentTodayRes);

        const pendingLeaves = allLeaves.filter((leave) => leave.status === "pending");

        setStats({
          pendingLeaves: pendingLeaves.length,
          presentToday: Array.isArray(presentToday) ? presentToday.length : 0,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="loading-message">🔄 Loading employee dashboard...</div>;

  return (
    <div className="employee-dashboard-home">
      <h1>Employee Dashboard</h1>

      {error && <div className="error-message">⚡ {error}</div>}

      <section className="leave-summary">
        <h2>My Leaves</h2>
        {leaveStatus.length > 0 ? (
          <ul className="leave-list">
            {leaveStatus.map((leave) => (
              <li key={leave.id}>
                <strong>{leave.leave_type}</strong>: {leave.start_date} to {leave.end_date} — <em>{leave.status}</em>
              </li>
            ))}
          </ul>
        ) : (
          <p>No leaves found</p>
        )}
      </section>

      <section className="attendance-summary">
        <h2>Recent Attendance</h2>
        {attendance.length > 0 ? (
          <table className="attendance-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Worked Hours</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((record) => (
                <tr key={record.id}>
                  <td>{new Date(record.date).toLocaleDateString()}</td>
                  <td>{record.status}</td>
                  <td>{record.check_in || "-"}</td>
                  <td>{record.check_out || "-"}</td>
                  <td>{record.worked_hours || "-"}</td>
                  <td>{record.remarks || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No recent attendance records found</p>
        )}
      </section>

      <section className="overall-stats">
        <h2>Company Stats</h2>
        <div className="stats-cards">
          <div className="stat-card">
            <h3>{stats.pendingLeaves}</h3>
            <p>Pending Leaves</p>
          </div>
          <div className="stat-card">
            <h3>{stats.presentToday}</h3>
            <p>Present Today</p>
          </div>
        </div>
      </section>
    </div>
  );
}
