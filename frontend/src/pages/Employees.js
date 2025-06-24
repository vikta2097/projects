import React, { useEffect, useState, useCallback } from "react";
import "../styles/Employees.css";

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [users, setUsers] = useState([]); // For user-employee linking
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formData, setFormData] = useState({
    user_id: "",
    name: "",
    department: "",
    job_title: "",
    date_of_hire: "",
    phone: "",
    address: "",
    status: "active"
  });

  const token = localStorage.getItem("token");

  // Fetch all employees with user information
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:3300/api/employees", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch employees: ${res.status}`);
      }

      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(`Error loading employees: ${err.message}`);
      console.error("Fetch employees error:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch all users for linking (admin responsibility)
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:3300/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error loading users:", err);
    }
  }, [token]);

  useEffect(() => {
    fetchEmployees();
    fetchUsers();
  }, [fetchEmployees, fetchUsers]);

  // Get available users (not already linked to employees)
  const getAvailableUsers = () => {
    const linkedUserIds = employees.map((emp) => emp.user_id);
    return users.filter(
      (user) =>
        !linkedUserIds.includes(user.id) ||
        (editingEmployee && user.id === editingEmployee.user_id)
    );
  };

  // Get user details by ID
  const getUserById = (userId) => {
    return users.find((user) => user.id === parseInt(userId));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Auto-fill name from selected user (admin convenience)
    if (name === "user_id" && value) {
      const selectedUser = getUserById(value);
      if (selectedUser && !editingEmployee) {
        setFormData((prev) => ({ ...prev, name: selectedUser.fullname }));
      }
    }
  };

  const validateForm = () => {
    if (!formData.user_id) {
      setError("Please select a user to link this employee to");
      return false;
    }

    if (!formData.name.trim()) {
      setError("Employee name is required");
      return false;
    }

    if (!formData.department.trim()) {
      setError("Department is required");
      return false;
    }

    if (!formData.job_title.trim()) {
      setError("Job title is required");
      return false;
    }

    if (!formData.date_of_hire) {
      setError("Date of hire is required");
      return false;
    }

    // Validate date is not in the future
    const hireDate = new Date(formData.date_of_hire);
    const today = new Date();
    if (hireDate > today) {
      setError("Date of hire cannot be in the future");
      return false;
    }

    if (!formData.phone.trim()) {
      setError("Phone number is required");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!validateForm()) return;

    setLoading(true);
    const method = editingEmployee ? "PUT" : "POST";
    const url = editingEmployee
      ? `http://localhost:3300/api/employees/${editingEmployee.id}`
      : "http://localhost:3300/api/employees";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(
          responseData.message ||
            `Failed to ${editingEmployee ? "update" : "create"} employee`
        );
      }

      setMessage(
        responseData.message ||
          `Employee ${editingEmployee ? "updated" : "created"} successfully`
      );
      await fetchEmployees();
      resetForm();
    } catch (err) {
      setError(err.message);
      console.error("Submit employee error:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      user_id: "",
      name: "",
      department: "",
      job_title: "",
      date_of_hire: "",
      phone: "",
      address: "",
      status: "active",
    });
    setEditingEmployee(null);
    setError("");
    setMessage("");
  };

  const handleEdit = (emp) => {
    setEditingEmployee(emp);
    setFormData({
      user_id: emp.user_id || "",
      name: emp.name || "",
      department: emp.department || "",
      job_title: emp.job_title || "",
      date_of_hire: emp.date_of_hire ? emp.date_of_hire.split("T")[0] : "",
      phone: emp.phone || "",
      address: emp.address || "",
      status: emp.status || "active",
    });
    setError("");
    setMessage("");
  };

  const handleDelete = async (id, employeeName) => {
    if (
      !window.confirm(
        `Are you sure you want to delete employee "${employeeName}"?\n\nThis action cannot be undone and will remove all associated records.`
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3300/api/employees/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData.message || "Failed to delete employee");
      }

      setMessage(`Employee "${employeeName}" deleted successfully`);
      await fetchEmployees();
    } catch (err) {
      setError(err.message);
      console.error("Delete employee error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (id, currentStatus, employeeName) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    const action = newStatus === "active" ? "activate" : "deactivate";

    if (
      !window.confirm(
        `Are you sure you want to ${action} employee "${employeeName}"?`
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3300/api/employees/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to ${action} employee`);
      }

      setMessage(`Employee "${employeeName}" ${action}d successfully`);
      await fetchEmployees();
    } catch (err) {
      setError(err.message);
      console.error(`Status toggle error:`, err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="employees-container">
      <h2>Employee Management</h2>
      <p className="admin-info">
        Admin Role: Create and manage employee records linked to user accounts
      </p>

      {/* Status Messages */}
      {loading && <div className="loading">Processing...</div>}
      {error && (
        <div
          className="error-message"
          style={{ color: "red", margin: "10px 0" }}
        >
          {error}
        </div>
      )}
      {message && (
        <div
          className="success-message"
          style={{ color: "green", margin: "10px 0" }}
        >
          {message}
        </div>
      )}

      {/* Employee Form */}
      <form className="employee-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>{editingEmployee ? "Update Employee" : "Add New Employee"}</h3>

          {/* User Selection - Key Admin Feature */}
          <div className="form-group">
            <label htmlFor="user_id">Link to User Account *</label>
            <select
              id="user_id"
              name="user_id"
              value={formData.user_id}
              onChange={handleInputChange}
              required
            >
              <option value="">Select a user...</option>
              {getAvailableUsers().map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullname} ({user.email}) - {user.role}
                </option>
              ))}
            </select>
            <small>Only users without existing employee records are shown</small>
          </div>

          <input
            name="name"
            placeholder="Full Name *"
            value={formData.name}
            onChange={handleInputChange}
            required
          />

          <input
            name="department"
            placeholder="Department *"
            value={formData.department}
            onChange={handleInputChange}
            required
          />

          <input
            name="job_title"
            placeholder="Job Title *"
            value={formData.job_title}
            onChange={handleInputChange}
            required
          />

          <input
            type="date"
            name="date_of_hire"
            placeholder="Date of Hire *"
            value={formData.date_of_hire}
            onChange={handleInputChange}
            required
          />

          <input
            name="phone"
            placeholder="Phone Number *"
            value={formData.phone}
            onChange={handleInputChange}
            required
          />

          <input
            name="address"
            placeholder="Address"
            value={formData.address}
            onChange={handleInputChange}
          />

          <select
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            required
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button type="submit" disabled={loading}>
            {editingEmployee ? "Update Employee" : "Add Employee"}
          </button>
          {editingEmployee && (
            <button type="button" onClick={resetForm} disabled={loading}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Employee List */}
      <h3>Employee List</h3>
      {employees.length === 0 && !loading ? (
        <p>No employees found.</p>
      ) : (
        <table className="employee-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>User Email</th>
              <th>Department</th>
              <th>Job Title</th>
              <th>Date of Hire</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const linkedUser = getUserById(emp.user_id);
              return (
                <tr key={emp.id}>
                  <td>{emp.name}</td>
                  <td>{linkedUser ? linkedUser.email : "Unknown"}</td>
                  <td>{emp.department}</td>
                  <td>{emp.job_title}</td>
                  <td>{emp.date_of_hire?.split("T")[0]}</td>
                  <td>{emp.phone}</td>
                  <td>{emp.address}</td>
                  <td>{emp.status}</td>
                  <td>
                    <button
                      onClick={() => handleEdit(emp)}
                      disabled={loading}
                      title="Edit employee"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(emp.id, emp.name)}
                      disabled={loading}
                      title="Delete employee"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() =>
                        handleStatusToggle(emp.id, emp.status, emp.name)
                      }
                      disabled={loading}
                      title={
                        emp.status === "active"
                          ? "Deactivate employee"
                          : "Activate employee"
                      }
                    >
                      {emp.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Employees;
