import React, { useEffect, useState, useCallback } from "react";
import '../styles/LeaveManagment.css';

const LeaveManagement = () => {
  const [leaves, setLeaves] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = localStorage.getItem("token");

  // Base URL for API calls - adjust this to match your backend
  const API_BASE_URL = "http://localhost:3300";


  // Memoize fetchLeaves so useEffect dependency is stable
  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Construct the full URL
      let url = `${API_BASE_URL}/api/leaves`;
      if (filter !== "all") {
        url += `?status=${filter}`;
      }

      console.log("Fetching leaves with token:", token);
console.log("Final URL:", url);


      const response = await fetch(url, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // More specific error handling
        if (response.status === 401) {
          throw new Error('Unauthorized - please log in again');
        } else if (response.status === 403) {
          throw new Error('Access denied - insufficient permissions');
        } else if (response.status === 404) {
          throw new Error('API endpoint not found');
        } else if (response.status === 500) {
          throw new Error('Server error - please try again later');
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }

      const data = await response.json();
      setLeaves(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching leave requests:", err);
      setError(err.message);
      setLeaves([]); // Clear leaves on error
    } finally {
      setLoading(false);
    }
  }, [filter, token, API_BASE_URL]);

  // Run fetchLeaves when filter or token changes
  useEffect(() => {
    if (token) {
      fetchLeaves();
    } else {
      setError('No authentication token found');
      setLoading(false);
    }
  }, [fetchLeaves, token]);

  const updateLeaveStatus = async (id, status) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaves/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Unauthorized - please log in again');
        } else if (res.status === 404) {
          throw new Error('Leave request not found');
        } else {
          throw new Error(`Failed to update leave status: ${res.status}`);
        }
      }

      // Refresh the list after successful update
      await fetchLeaves();
    } catch (err) {
      console.error("Error updating leave status:", err);
      alert(`Error updating leave status: ${err.message}`);
    }
  };

  const deleteLeave = async (id) => {
    if (!window.confirm("Are you sure you want to delete this leave request?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/leaves/${id}`, {
        method: "DELETE",
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Unauthorized - please log in again');
        } else if (res.status === 404) {
          throw new Error('Leave request not found');
        } else {
          throw new Error(`Failed to delete leave request: ${res.status}`);
        }
      }

      // Remove from local state after successful deletion
      setLeaves((prev) => prev.filter((leave) => leave.id !== id));
    } catch (err) {
      console.error("Error deleting leave request:", err);
      alert(`Error deleting leave request: ${err.message}`);
    }
  };

  // Retry function for failed requests
  const handleRetry = () => {
    fetchLeaves();
  };

  return (
    <div className="leave-management">
      <h2>Leave Management</h2>

      <div className="leave-filter">
        <label>Status Filter:</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={handleRetry} className="retry-btn">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p>Loading leave requests...</p>
      ) : (
        <table className="leave-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Employee</th>
              <th>Type</th>
              <th>Start</th>
              <th>End</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaves.length === 0 ? (
              <tr className="leave-empty-row">
                <td colSpan="8">
                  {error ? 'Unable to load leave requests due to error above.' : 'No leave requests found.'}
                </td>
              </tr>
            ) : (
              leaves.map((leave) => (
                <tr key={leave.id}>
                  <td>{leave.id}</td>
                  <td>{leave.employee_name} (ID: {leave.employee_id})</td>
                  <td>{leave.leave_type}</td>
                  <td>{leave.start_date}</td>
                  <td>{leave.end_date}</td>
                  <td>{leave.reason}</td>
                  <td>
                    {leave.status}
                  </td>
                  <td>
                    {leave.status === "pending" && (
                      <>
                        <button
                          className="leave-action-btn approve"
                          onClick={() => updateLeaveStatus(leave.id, "approved")}
                        >
                          Approve
                        </button>
                        <button
                          className="leave-action-btn reject"
                          onClick={() => updateLeaveStatus(leave.id, "rejected")}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <button
                      className="leave-action-btn delete"
                      onClick={() => deleteLeave(leave.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default LeaveManagement;