import React, { useEffect, useState } from "react";
import "../styles/EmployeeDashboardHome.css";
import NotificationComponent from "../pages/Notifications";

export default function EmployeeDashboardHome() {
  const [leaveStatus, setLeaveStatus] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // Decode token payload safely
  const getUserFromToken = (token) => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return {
        id: payload.id || payload.userId || payload.sub,
        email: payload.email || null,
        role: payload.role || null,
      };
    } catch (err) {
      console.error("Failed to parse token:", err);
      return null;
    }
  };

  // Helper to check fetch response and parse JSON
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

      const token = localStorage.getItem("token");
      if (!token) {
        setError("No authentication token.");
        setLoading(false);
        return;
      }

      // Decode token to get minimal user info (id and email)
      const userFromToken = getUserFromToken(token);
      if (!userFromToken) {
        setError("Invalid authentication token.");
        setLoading(false);
        return;
      }

      try {
        // Fetch full profile info from backend
        const profileRes = await fetch("http://localhost:3300/api/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const profileData = await checkResponse(profileRes);
        setCurrentUser({
          ...userFromToken,
          fullname: profileData.fullname,
          department: profileData.department,
          job_title: profileData.job_title,
          // add more fields here if needed
        });

        // Fetch user-specific leaves and attendance in parallel
        const [leavesRes, attendanceRes] = await Promise.all([
          fetch("http://localhost:3300/api/leaves/my", {
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
      {/* Header with Welcome message and Notifications */}
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
          {currentUser ? (
            <span>
              Welcome, {currentUser.fullname || currentUser.email || "User"}
            </span>
          ) : (
            <span>Welcome, User</span>
          )}
        </div>
        <div>{currentUser && <NotificationComponent userId={currentUser.id} />}</div>
      </div>

      {/* Main Dashboard Content */}
      <div className="employee-dashboard-home">
        <h1>Employee Dashboard</h1>

        {error && <div className="error-message">⚡ {error}</div>}

        <section className="leave-summary">
          <h2>My Leaves</h2>
          {leaveStatus.length > 0 ? (
            <ul className="leave-list">
              {leaveStatus.map((leave) => (
                <li key={leave.id}>
                  <strong>{leave.leave_type}</strong>: {leave.start_date} to{" "}
                  {leave.end_date} — <em>{leave.status}</em>
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
              <h3>{leaveStatus.filter((leave) => leave.status === "pending").length}</h3>
              <p>My Pending Leaves</p>
            </div>
            <div className="stat-card">
              <h3>{attendance.filter((att) => att.status === "Present").length}</h3>
              <p>Days Present</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
