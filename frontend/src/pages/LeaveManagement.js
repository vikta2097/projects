import React, { useEffect, useState, useCallback } from "react";
import "../styles/LeaveManagment.css";

const API_BASE_URL = "http://localhost:3300";

const LeaveManagement = () => {
  // Leave requests and balances
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState([]);

  // Filters & loading/error states
  const [filter, setFilter] = useState("all");
  const [loadingLeaves, setLoadingLeaves] = useState(true);
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [errorLeaves, setErrorLeaves] = useState(null);
  const [errorBalances, setErrorBalances] = useState(null);

  // Days input state for manual editing of leave days
  const [daysInputs, setDaysInputs] = useState({});

  // Leave limits (admin role)
  const [leaveLimits, setLeaveLimits] = useState([]);
  const [loadingLimits, setLoadingLimits] = useState(true);
  const [errorLimits, setErrorLimits] = useState(null);

  // Leave limit form state
  const [limitForm, setLimitForm] = useState({
    employee_id: "",
    leave_type: "",
    max_days: "",
  });
  const [limitFormMessage, setLimitFormMessage] = useState("");

  // Employees list (for dropdown)
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [errorEmployees, setErrorEmployees] = useState(null);

  // Auth token
  const token = localStorage.getItem("token");

  // Fetch employees for dropdown and display
  const fetchEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    setErrorEmployees(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch employees");
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorEmployees("Failed to load employees");
      setEmployees([]);
      console.error(err);
    } finally {
      setLoadingEmployees(false);
    }
  }, [token]);

  // Fetch leave requests
  const fetchLeaves = useCallback(async () => {
    setLoadingLeaves(true);
    setErrorLeaves(null);
    try {
      let url = `${API_BASE_URL}/api/leaves`;
      if (filter !== "all") url += `?status=${filter}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch leaves");
      const data = await res.json();
      setLeaves(Array.isArray(data) ? data : []);
      // Initialize daysInputs for editing
      const initialDays = {};
      data.forEach((leave) => {
        initialDays[leave.id] = leave.days ?? 0;
      });
      setDaysInputs(initialDays);
    } catch {
      setErrorLeaves("Error fetching leave requests");
      setLeaves([]);
    } finally {
      setLoadingLeaves(false);
    }
  }, [filter, token]);

  // Fetch leave balances
  const fetchBalances = useCallback(async () => {
    setLoadingBalances(true);
    setErrorBalances(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaves/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch leave balances");
      const data = await res.json();
      if (Array.isArray(data)) {
        setBalances(data);
      } else if (data.balances) {
        const entries = Object.entries(data.balances).map(([leave_type, balance]) => ({
          employee_name: "You",
          leave_type,
          balance,
        }));
        setBalances(entries);
      } else {
        setBalances([]);
      }
    } catch (err) {
      setErrorBalances("Failed to load leave balances");
      setBalances([]);
      console.error(err);
    } finally {
      setLoadingBalances(false);
    }
  }, [token]);

  const leaveTypes = [
  { value: 'annual', label: 'Annual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'compassionate', label: 'Compassionate Leave' },
  { value: 'study', label: 'Study Leave' },
  // Add more as needed
];


  // Fetch leave limits
  const fetchLeaveLimits = useCallback(async () => {
    setLoadingLimits(true);
    setErrorLimits(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaves/leave_limits`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch leave limits");
      const data = await res.json();
      setLeaveLimits(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorLimits("Error loading leave limits");
      setLeaveLimits([]);
      console.error(err);
    } finally {
      setLoadingLimits(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setErrorLeaves("Missing authentication token.");
      setErrorBalances("Missing authentication token.");
      setErrorLimits("Missing authentication token.");
      setLoadingLeaves(false);
      setLoadingBalances(false);
      setLoadingLimits(false);
      setLoadingEmployees(false);
      setErrorEmployees("Missing authentication token.");
    } else {
      fetchLeaves();
      fetchBalances();
      fetchLeaveLimits();
      fetchEmployees();
    }
  }, [fetchLeaves, fetchBalances, fetchLeaveLimits, fetchEmployees, token]);

  // Update leave days manually
  const updateDays = async (leaveId) => {
    const newDays = daysInputs[leaveId];
    if (newDays === undefined || newDays < 0) {
      alert("Please enter a valid number of days.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaves/${leaveId}/days`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ days: newDays }),
      });
      if (!res.ok) throw new Error("Failed to update days");
      alert("Days updated successfully.");
      fetchLeaves();
      fetchBalances();
    } catch (err) {
      alert(err.message);
    }
  };

  // Approve or reject leave
  const updateLeaveStatus = async (id, status) => {
    if (!window.confirm(`Mark leave as ${status}?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaves/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Status update failed");
      alert(`Leave ${status} successfully.`);
      fetchLeaves();
      fetchBalances();
    } catch (err) {
      alert(err.message);
    }
  };

  // Delete leave request
  const deleteLeave = async (id) => {
    if (!window.confirm("Delete this leave?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaves/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete leave");
      alert("Leave deleted.");
      setLeaves((prev) => prev.filter((l) => l.id !== id));
      fetchBalances();
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle leave limit form changes
  const handleLimitFormChange = (e) => {
    const { name, value } = e.target;
    setLimitForm((prev) => ({ ...prev, [name]: value }));
    setLimitFormMessage("");
  };

  // Submit leave limit (add/update)
  const submitLeaveLimit = async (e) => {
    e.preventDefault();
    setLimitFormMessage("");
    if (!limitForm.employee_id || !limitForm.leave_type || !limitForm.max_days) {
      setLimitFormMessage("Please fill all fields");
      return;
    }
    if (isNaN(limitForm.max_days) || limitForm.max_days <= 0) {
      setLimitFormMessage("Max days must be a positive number");
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaves/leave_limits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(limitForm),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to save leave limit");
      }
      alert("Leave limit saved successfully.");
      setLimitForm({ employee_id: "", leave_type: "", max_days: "" });
      fetchLeaveLimits();
    } catch (err) {
      setLimitFormMessage(err.message);
    }
  };

  return (
    <div className="leave-management">
      <h2>HR - Leave Management</h2>

      {/* Filter leave requests */}
      <section className="filter-section" aria-label="Filter Leave Requests">
        <label htmlFor="statusFilter">Filter leave requests by status:</label>
        <select
          id="statusFilter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          disabled={loadingLeaves}
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </section>

      {/* Leave requests table */}
      <section className="leave-requests-section" aria-label="Leave Requests">
        {errorLeaves && <div className="error-message">{errorLeaves}</div>}
        {loadingLeaves ? (
          <p>Loading leave requests...</p>
        ) : (
          <table className="leave-table" aria-label="Leave Requests Table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Employee</th>
                <th>Type</th>
                <th>Start</th>
                <th>End</th>
                <th>Days</th>
                <th>Actions</th>
                <th>Status</th>
                <th>Leave Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan="9">No leave requests found.</td>
                </tr>
              ) : (
                leaves.map((leave) => (
                  <tr key={leave.id}>
                    <td>{leave.id}</td>
                    <td>{leave.employee_name || `ID: ${leave.employee_id}`}</td>
                    <td>{leave.leave_type}</td>
                    <td>{new Date(leave.start_date).toLocaleDateString()}</td>
                    <td>{new Date(leave.end_date).toLocaleDateString()}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={daysInputs[leave.id] ?? 0}
                        onChange={(e) =>
                          setDaysInputs({
                            ...daysInputs,
                            [leave.id]: Number(e.target.value),
                          })
                        }
                        style={{ width: "60px" }}
                        disabled={loadingLeaves}
                        aria-label={`Edit leave days for request ${leave.id}`}
                      />
                    </td>
                    <td>
                      <button
                        onClick={() => updateDays(leave.id)}
                        disabled={loadingLeaves}
                        aria-label={`Save leave days for request ${leave.id}`}
                      >
                        Save
                      </button>
                    </td>
                    <td className={`status-${leave.status}`}>{leave.status}</td>
                    <td>
                      {leave.status === "pending" && (
                        <>
                          <button
                            onClick={() => updateLeaveStatus(leave.id, "approved")}
                            disabled={loadingLeaves}
                            aria-label={`Approve leave request ${leave.id}`}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => updateLeaveStatus(leave.id, "rejected")}
                            disabled={loadingLeaves}
                            aria-label={`Reject leave request ${leave.id}`}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => deleteLeave(leave.id)}
                        disabled={loadingLeaves}
                        aria-label={`Delete leave request ${leave.id}`}
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
      </section>

      {/* Leave balances */}
      <section className="leave-balances-section" aria-label="Leave Balances">
        <h3>Leave Balances</h3>
        {errorBalances && <div className="error-message">{errorBalances}</div>}
        {loadingBalances ? (
          <p>Loading leave balances...</p>
        ) : balances.length === 0 ? (
          <p>No leave balances available.</p>
        ) : (
          <table className="leave-balance-table" aria-label="Leave Balances Table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Leave Type</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b, i) => (
                <tr key={i}>
                  <td>{b.employee_name || `ID: ${b.employee_id}`}</td>
                  <td>{b.leave_type}</td>
                  <td>{b.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Leave limits management */}
      <section className="leave-limits-section" aria-label="Manage Leave Limits">
        <h3>Set Maximum Leave Days Per Employee & Leave Type</h3>

        {errorLimits && <div className="error-message">{errorLimits}</div>}

        {loadingLimits ? (
          <p>Loading leave limits...</p>
        ) : (
          <>
            {leaveLimits.length === 0 ? (
              <p>No leave limits set yet.</p>
            ) : (
              <table className="leave-limit-table" aria-label="Leave Limits Table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Leave Type</th>
                    <th>Max Days</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveLimits.map((limit) => {
                    const emp = employees.find((e) => e.id === limit.employee_id);
                    const employeeName = emp ? (emp.fullname || emp.name) : `ID: ${limit.employee_id}`;
                    return (
                      <tr key={limit.id}>
                        <td>{employeeName}</td>
                        <td>{limit.leave_type}</td>
                        <td>{limit.max_days}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Leave limit form */}
            <form
              className="leave-limit-form"
              onSubmit={submitLeaveLimit}
              aria-label="Add or Update Leave Limit Form"
            >
              <h4>Add / Update Leave Limit</h4>

              <label htmlFor="employee_id">Employee</label>
              {loadingEmployees ? (
                <p>Loading employees...</p>
              ) : errorEmployees ? (
                <p className="error-message">{errorEmployees}</p>
              ) : (
                <select
                  id="employee_id"
                  name="employee_id"
                  value={limitForm.employee_id}
                  onChange={handleLimitFormChange}
                  required
                  aria-required="true"
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullname || emp.name || `ID: ${emp.id}`}
                    </option>
                  ))}
                </select>
              )}

              <label htmlFor="leave_type">Leave Type</label>
<select
  id="leave_type"
  name="leave_type"
  value={limitForm.leave_type}
  onChange={handleLimitFormChange}
  required
  aria-required="true"
>
  <option value="">-- Select Leave Type --</option>
  {leaveTypes.map((type) => (
    <option key={type.value} value={type.value}>
      {type.label}
    </option>
  ))}
</select>


              <label htmlFor="max_days">Maximum Days</label>
              <input
                id="max_days"
                name="max_days"
                type="number"
                min="1"
                value={limitForm.max_days}
                onChange={handleLimitFormChange}
                required
                aria-required="true"
                placeholder="Enter max allowed days"
              />

              {limitFormMessage && <p className="form-message">{limitFormMessage}</p>}

              <button type="submit" aria-label="Save Leave Limit">
                Save Limit
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
};

export default LeaveManagement;
