import React, { useEffect, useState, useCallback } from "react";
import "../styles/Employees.css";

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [users, setUsers] = useState([]);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filterType, setFilterType] = useState("");
  const [formData, setFormData] = useState({
    user_id: "",
    name: "",
    department: "",
    job_title: "",
    date_of_hire: "",
    phone: "",
    address: "",
    status: "active",
    type: "permanent",
  });

  const token = localStorage.getItem("token");

  // Fetch employees
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:3300/api/employees", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to fetch employees: ${res.status}`);
      }

      const data = await res.json();

      // FIX HERE: backend returns array directly, not inside data.data
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(`Error loading employees: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch users not linked to employees
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

  // Users available to link as employee (not already linked)
  const getAvailableUsers = () => {
    const linkedUserIds = employees.map((emp) => emp.user_id);
    return users.filter(
      (user) =>
        !linkedUserIds.includes(user.id) ||
        (editingEmployee && user.id === editingEmployee.user_id)
    );
  };

  // Find user by id
  const getUserById = (userId) => {
    return users.find((user) => user.id === parseInt(userId));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "user_id" && value) {
      const selectedUser = getUserById(value);
      if (selectedUser && !editingEmployee) {
        setFormData((prev) => ({ ...prev, name: selectedUser.fullname }));
      }
    }
  };

  const validateForm = () => {
    if (!formData.user_id) return setError("Please select a user"), false;
    if (!formData.name.trim()) return setError("Name is required"), false;
    if (!formData.department.trim()) return setError("Department is required"), false;
    if (!formData.job_title.trim()) return setError("Job title is required"), false;
    if (!formData.date_of_hire) return setError("Date of hire is required"), false;

    const hireDate = new Date(formData.date_of_hire);
    if (hireDate > new Date()) return setError("Date cannot be in the future"), false;

    if (!formData.phone.trim()) return setError("Phone is required"), false;

    if (!formData.type) return setError("Employee type is required"), false;

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

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Error saving employee");

      setMessage(data.message || "Success");
      await fetchEmployees();
      resetForm();
    } catch (err) {
      setError(err.message);
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
      type: "permanent",
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
      date_of_hire: emp.date_of_hire?.split("T")[0] || "",
      phone: emp.phone || "",
      address: emp.address || "",
      status: emp.status || "active",
      type: emp.type || "permanent",
    });
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;

    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3300/api/employees/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to delete");

      setMessage(`Deleted: ${name}`);
      await fetchEmployees();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (id, currentStatus, name) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    if (!window.confirm(`Change status of "${name}" to ${newStatus}?`)) return;

    setLoading(true);
    try {
      // Only send status update in body to prevent overwriting other fields
      const res = await fetch(`http://localhost:3300/api/employees/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Status change failed");

      setMessage(`Status updated for ${name}`);
      await fetchEmployees();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = filterType
    ? employees.filter((e) => e.type === filterType)
    : employees;

  return (
    <div className="employees-container">
      <h2>Employee Management</h2>
      <p className="admin-info">
        Admin Role: Create and manage employee records linked to user accounts
      </p>

      {loading && <p className="loading">Loading...</p>}
      {error && <p className="error-message">{error}</p>}
      {message && <p className="success-message">{message}</p>}

      <form className="employee-form" onSubmit={handleSubmit}>
        <h3>{editingEmployee ? "Update Employee" : "Add New Employee"}</h3>

        <div className="form-group">
          <label>User Account *</label>
          <select
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

        <select
          name="type"
          value={formData.type}
          onChange={handleInputChange}
          required
        >
          <option value="">Select Employee Type *</option>
          <option value="permanent">Permanent</option>
          <option value="contract">Contract</option>
          <option value="intern">Intern</option>
          <option value="casual">Casual</option>
          <option value="probation">Probation</option>
          <option value="part-time">Part-Time</option>
          <option value="temporary">Temporary</option>
          <option value="volunteer">Volunteer</option>
          <option value="consultant">Consultant</option>
        </select>

        <button type="submit" disabled={loading}>
          {editingEmployee ? "Update" : "Add"}
        </button>
        {editingEmployee && (
          <button type="button" onClick={resetForm} disabled={loading}>
            Cancel
          </button>
        )}
      </form>

      {/* Filter */}
      <div className="filter-group">
        <label>Filter by Type:</label>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All</option>
          <option value="permanent">Permanent</option>
          <option value="contract">Contract</option>
          <option value="intern">Intern</option>
          <option value="casual">Casual</option>
          <option value="probation">Probation</option>
          <option value="part-time">Part-Time</option>
          <option value="temporary">Temporary</option>
          <option value="volunteer">Volunteer</option>
          <option value="consultant">Consultant</option>
        </select>
      </div>

      <h3>Employee List</h3>
      {filteredEmployees.length === 0 ? (
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
              <th>Type</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((emp) => {
              const linkedUser = getUserById(emp.user_id);
              return (
                <tr key={emp.id}>
                  <td>{emp.name}</td>
                  <td>{linkedUser?.email || "Unknown"}</td>
                  <td>{emp.department}</td>
                  <td>{emp.job_title}</td>
                  <td>{emp.date_of_hire?.split("T")[0]}</td>
                  <td>{emp.phone}</td>
                  <td>{emp.address}</td>
                  <td>{emp.status}</td>
                  <td>{emp.type}</td>
                  <td>
                    <button onClick={() => handleEdit(emp)} disabled={loading}>Edit</button>
                    <button onClick={() => handleDelete(emp.id, emp.name)} disabled={loading}>Delete</button>
                    <button
                      onClick={() =>
                        handleStatusToggle(emp.id, emp.status, emp.name)
                      }
                      disabled={loading}
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
