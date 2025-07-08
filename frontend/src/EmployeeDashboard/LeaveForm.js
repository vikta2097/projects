import React, { useState } from "react";
import API_BASE_URL from "../api";  // Adjust path if needed
import "../styles/LeaveForm.css";

export default function LeaveForm({ onAdd }) {
  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/api/leaves`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ leaveType, startDate, endDate, reason }),
      });

      if (res.ok) {
        setLeaveType("");
        setStartDate("");
        setEndDate("");
        setReason("");
        const newLeave = await res.json();
        if (onAdd) onAdd(newLeave);
      } else {
        const errorData = await res.json();
        setError(errorData.message);
      }
    } catch (err) {
      setError(err.toString());
    }
  };

  return (
    <div className="leave-form">
      <h2>Apply for Leave</h2>
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <label htmlFor="leaveType">Leave Type</label>
        <input
          id="leaveType"
          type="text"
          value={leaveType}
          onChange={(e) => setLeaveType(e.target.value)}
          placeholder="Leave Type"
          required
        />

        <label htmlFor="startDate">Start Date</label>
        <input
          id="startDate"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />

        <label htmlFor="endDate">End Date</label>
        <input
          id="endDate"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          required
        />

        <label htmlFor="reason">Reason for Leave</label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for leave"
        />

        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
