import React, { useState, useEffect } from "react";
import API_BASE_URL from "../api";
import "../styles/LeaveForm.css";

export default function LeaveForm() {
  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [leaveBalances, setLeaveBalances] = useState({});
  const [leaveAccrued, setLeaveAccrued] = useState({});
  const [leaveUsed, setLeaveUsed] = useState({});
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Employee's own leave requests:
  const [myLeaves, setMyLeaves] = useState([]);
  const [loadingMyLeaves, setLoadingMyLeaves] = useState(true);
  const [errorMyLeaves, setErrorMyLeaves] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("User not authenticated");
      setLoadingBalances(false);
      setLoadingMyLeaves(false);
      return;
    }

    async function fetchLeaveBalances() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/leaves/balance`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error("Failed to fetch leave balances");
        const data = await res.json();

        // data = { accrued: {...}, used: {...}, balances: {...} }
        setLeaveAccrued(data.accrued || {});
        setLeaveUsed(data.used || {});
        setLeaveBalances(data.balances || {});
      } catch (err) {
        console.error("Error fetching balances:", err);
        setLeaveBalances({});
        setLeaveAccrued({});
        setLeaveUsed({});
      } finally {
        setLoadingBalances(false);
      }
    }

    async function fetchMyLeaves() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/leaves/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch your leave requests");
        const data = await res.json();
        setMyLeaves(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching my leaves:", err);
        setErrorMyLeaves("Failed to load your leave requests");
        setMyLeaves([]);
      } finally {
        setLoadingMyLeaves(false);
      }
    }

    fetchLeaveBalances();
    fetchMyLeaves();
  }, []);

  // Get leave types dynamically from balances keys
  const leaveTypes = Object.keys(leaveBalances).length > 0 ? Object.keys(leaveBalances) : [];

  const requestedDays = (() => {
    if (!startDate || !endDate) return 0;
    const diffMs = new Date(endDate) - new Date(startDate);
    return diffMs >= 0 ? Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1 : 0;
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!leaveType) {
      setError("Please select a leave type.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Please select both start and end dates.");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError("End date cannot be before start date.");
      return;
    }
    if (requestedDays <= 0) {
      setError("Invalid date range.");
      return;
    }

    const availableBalance = leaveBalances[leaveType] ?? 0;
    if (leaveType !== "unpaid" && requestedDays > availableBalance) {
      setError(
        `Requested days (${requestedDays}) exceed your remaining balance (${availableBalance.toFixed(
          2
        )}) for ${leaveType}.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("User is not authenticated.");
        setSubmitting(false);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/leaves`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason,
        }),
      });

      if (res.ok) {
        setLeaveType("");
        setStartDate("");
        setEndDate("");
        setReason("");
        setSuccessMessage("Leave request submitted successfully.");

        const newLeave = await res.json();
        setMyLeaves((prev) => [...prev, newLeave]);
      } else {
        const errorData = await res.json();
        setError(errorData.message || "Failed to submit leave.");
      }
    } catch (err) {
      setError(err.toString());
    } finally {
      setSubmitting(false);
    }
  };

  const cancelLeave = async (leaveId) => {
    if (!window.confirm("Are you sure you want to cancel this leave request?")) return;
    setError("");
    setSuccessMessage("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("User is not authenticated.");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/leaves/${leaveId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to cancel leave");
      }

      setMyLeaves((prev) => prev.filter((leave) => leave.id !== leaveId));
      setSuccessMessage("Leave request canceled.");
    } catch (err) {
      setError(err.toString());
    }
  };

  return (
    <div className="leave-form">
      <h2>Apply for Leave</h2>

      <div className="leave-balances">
        <h4>Your Leave Balances:</h4>
        {loadingBalances ? (
          <p>Loading balances...</p>
        ) : leaveTypes.length === 0 ? (
          <p>No leave balance information available.</p>
        ) : (
          <ul>
            {leaveTypes.map((type) => {
              const remaining = leaveBalances[type] ?? 0;
              const accrued = leaveAccrued[type] ?? 0;
              const used = leaveUsed[type] ?? 0;
              const displayName = type.charAt(0).toUpperCase() + type.slice(1);
              return (
                <li
                  key={type}
                  style={{ opacity: remaining === 0 && type !== "unpaid" ? 0.5 : 1 }}
                  title={`Accrued: ${accrued} days, Used: ${used} days`}
                >
                  <strong>{displayName}:</strong> {remaining.toFixed(2)} days remaining
                  {accrued ? ` (Accrued: ${accrued.toFixed(2)}, Used: ${used.toFixed(2)})` : ""}
                  {remaining === 0 && type !== "unpaid" ? " — No remaining days" : ""}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error && <div className="error-message" role="alert">{error}</div>}
      {successMessage && <div className="success-message" role="status">{successMessage}</div>}

      <form onSubmit={handleSubmit} aria-label="Leave application form">
        <label htmlFor="leaveType">Leave Type</label>
        <select
          id="leaveType"
          value={leaveType}
          onChange={(e) => setLeaveType(e.target.value)}
          disabled={loadingBalances || submitting}
          required
        >
          <option value="">-- Select Leave Type --</option>
          {leaveTypes.map((type) => {
            const remaining = leaveBalances[type] ?? 0;
            const disabled = remaining === 0 && type !== "unpaid";
            return (
              <option key={type} value={type} disabled={disabled}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
                {disabled ? " (No days remaining)" : ""}
              </option>
            );
          })}
        </select>

        <label htmlFor="startDate">Start Date</label>
        <input
          id="startDate"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          disabled={submitting}
          required
        />

        <label htmlFor="endDate">End Date</label>
        <input
          id="endDate"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          disabled={submitting}
          required
        />

        <label htmlFor="reason">Reason for Leave (optional)</label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for leave"
          rows={3}
          disabled={submitting}
        />

        <p>
          Requested Days: <strong>{requestedDays}</strong>
        </p>

        <button type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Leave Request"}
        </button>
      </form>

      <section className="my-leaves" aria-label="Your Leave Requests">
        <h3>Your Leave Requests</h3>
        {loadingMyLeaves ? (
          <p>Loading your leave requests...</p>
        ) : errorMyLeaves ? (
          <p className="error-message">{errorMyLeaves}</p>
        ) : myLeaves.length === 0 ? (
          <p>You have no leave requests.</p>
        ) : (
          <table className="leave-table" aria-label="Your leave requests table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Start</th>
                <th>End</th>
                <th>Days</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {myLeaves.map((leave) => (
                <tr key={leave.id}>
                  <td>{leave.leave_type}</td>
                  <td>{new Date(leave.start_date).toLocaleDateString()}</td>
                  <td>{new Date(leave.end_date).toLocaleDateString()}</td>
                  <td>{leave.days}</td>
                  <td className={`status-${leave.status}`}>{leave.status}</td>
                  <td>
                    {leave.status === "pending" ? (
                      <button
                        className="leave-action-btn cancel"
                        onClick={() => cancelLeave(leave.id)}
                        aria-label={`Cancel leave request ${leave.id}`}
                      >
                        Cancel
                      </button>
                    ) : (
                      <em>No actions available</em>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
