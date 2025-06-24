import React, { useState } from "react";
import "../styles/LeaveForm.css";  // Adjust path as needed




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

      const res = await fetch("/api/leaves", {
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
        <input
          type="text"
          value={leaveType}
          onChange={(e) => setLeaveType(e.target.value)}
          placeholder="Leave Type"
          required
        />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          required
        />
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for leave"
        />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
