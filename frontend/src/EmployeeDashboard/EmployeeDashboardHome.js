import React, { useEffect, useState } from "react";
import "../styles/EmployeeDashboardHome.css";
import NotificationComponent from "../pages/Notifications";

export default function EmployeeDashboardHome() {
  const [leaveStatus, setLeaveStatus] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [stats, setStats] = useState({ pendingLeaves: 0, presentToday: 0 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null); // current user state

  // Helper: Extract user ID from JWT token payload
  const getUserIdFromToken = (token) => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.userId || payload.id || payload.sub; // common fields
    } catch (err) {
      console.error("Failed to parse token:", err);
      return null;
    }
  };

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

        // Option 2: Extract user info directly from token (no backend call)
        const userId = getUserIdFromToken(token);
        if (!userId) throw new Error("Invalid token: user ID missing");
        setCurrentUser({ id: userId });

        // Fetch user-specific leaves and attendance using token
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

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading)
    return <div className="loading-message">🔄 Loading employee dashboard...</div>;

  return (
    <div>
      {/* Notification bell and welcome message */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div>
          {currentUser && (
            <span>
              Welcome, {currentUser.fullname || currentUser.email || ` ${currentUser.fullname}`}
            </span>
          )}
        </div>
        <div>{currentUser && <NotificationComponent userId={currentUser.id} />}</div>
      </div>

      {/* Existing dashboard content */}
      <div className="employee-dashboard-home">
        <h1>Employee Dashboard</h1>

        {error && <div className="error-message">⚡ {error}</div>}

        <section className="leave-summary">
          <h2>My Leaves</h2>
          {leaveStatus.length > 0 ? (
            <ul className="leave-list">
              {leaveStatus.map((leave) => (
                <li key={leave.id}>
                  <strong>{leave.leave_type}</strong>: {leave.start_date} to {leave.end_date} —{" "}
                  <em>{leave.status}</em>
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
          <h2>My Stats</h2>
          <div className="stats-cards">
            <div className="stat-card">
              <h3>{leaveStatus.filter(leave => leave.status === "pending").length}</h3>
              <p>My Pending Leaves</p>
            </div>
            <div className="stat-card">
              <h3>{attendance.filter(att => att.status === "Present").length}</h3>
              <p>Days Present</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
