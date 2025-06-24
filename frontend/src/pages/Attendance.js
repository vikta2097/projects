import React, { useEffect, useState } from 'react';
import '../styles/Attendance.css';

function Attendance() {
  const [attendance, setAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeMap, setEmployeeMap] = useState({});
  const [form, setForm] = useState({
    employee_id: '',
    date: '',
    check_in: '',
    check_out: '',
    status: 'present', // default status
    check_in_location: '',
    check_out_location: '',
    worked_hours: '',
    is_late: false,
    remarks: '',
    leave_type: '', // added leave_type
  });
  const [editingId, setEditingId] = useState(null);

  // Format Date to YYYY-MM-DD
  const formatDate = (isoDate) => {
    const date = new Date(isoDate);
    return date.toISOString().split("T")[0];
  };

  // Format time HH:mm
  const formatTime = (date) => {
    const d = new Date(date);
    return d.toTimeString().slice(0, 5);
  };

  useEffect(() => {
    fetchAttendance();
    fetchEmployees();

    if (!editingId) {
      setForm(form => ({
        ...form,
        date: formatDate(new Date()),
        check_in: formatTime(new Date()),
        status: 'present',
        leave_type: '',
      }));
    }
  }, [editingId]);

  const fetchAttendance = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/attendance', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch attendance');
      const data = await res.json();
      setAttendance(data);
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/employees', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch employees');
      const data = await res.json();
      setEmployees(data);

      const map = {};
      data.forEach(emp => {
        map[emp.id] = {
          name: emp.name,
          department: emp.department,
          job_title: emp.job_title,
        };
      });
      setEmployeeMap(map);
    } catch (err) {
      console.error(err);
      alert('Could not load employees');
    }
  };

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm({
      ...form,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `/api/attendance/${editingId}` : '/api/attendance';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error('Error saving attendance record');

      alert(editingId ? 'Attendance updated' : 'Attendance recorded');
      setForm({
        employee_id: '',
        date: formatDate(new Date()),
        check_in: formatTime(new Date()),
        check_out: '',
        status: 'present',
        check_in_location: '',
        check_out_location: '',
        worked_hours: '',
        is_late: false,
        remarks: '',
        leave_type: '',
      });
      setEditingId(null);
      fetchAttendance();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = record => {
    setForm({
      employee_id: record.employee_id,
      date: record.date,
      check_in: record.check_in,
      check_out: record.check_out,
      status: record.status,
      check_in_location: record.check_in_location,
      check_out_location: record.check_out_location,
      worked_hours: record.worked_hours,
      is_late: record.is_late === 1 || record.is_late === true,
      remarks: record.remarks,
      leave_type: record.leave_type || '',
    });
    setEditingId(record.id);
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this attendance record?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/attendance/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete attendance record');
      alert('Attendance record deleted');
      fetchAttendance();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="attendance-container">
      <div>
        <h2>{editingId ? 'Edit Attendance' : 'Add Attendance'}</h2>
        <form onSubmit={handleSubmit}>
          <select name="employee_id" value={form.employee_id} onChange={handleChange} required>
            <option value="">Select Employee</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name} (ID: {emp.id})
              </option>
            ))}
          </select>

          <input type="date" name="date" value={form.date} onChange={handleChange} required />

          <input type="time" name="check_in" value={form.check_in} onChange={handleChange} />

          <input type="time" name="check_out" value={form.check_out} onChange={handleChange} />

          <select name="status" value={form.status} onChange={handleChange} required>
            <option value="">Select Status</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="leave">Leave</option>
            <option value="holiday">Holiday</option>
          </select>

          {form.status === 'leave' && (
            <input
              name="leave_type"
              value={form.leave_type}
              onChange={handleChange}
              placeholder="Leave Type"
              required
            />
          )}

          <input
            name="check_in_location"
            value={form.check_in_location}
            onChange={handleChange}
            placeholder="Check-in Location"
          />

          <input
            name="check_out_location"
            value={form.check_out_location}
            onChange={handleChange}
            placeholder="Check-out Location"
          />

          <input
            name="worked_hours"
            type="number"
            step="0.01"
            value={form.worked_hours}
            onChange={handleChange}
            placeholder="Worked Hours"
          />

          <label>
            Late:
            <input type="checkbox" name="is_late" checked={form.is_late} onChange={handleChange} />
          </label>

          <input name="remarks" value={form.remarks} onChange={handleChange} placeholder="Remarks" />

          <button type="submit">{editingId ? 'Update' : 'Add'}</button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({
                  employee_id: '',
                  date: formatDate(new Date()),
                  check_in: formatTime(new Date()),
                  check_out: '',
                  status: 'present',
                  check_in_location: '',
                  check_out_location: '',
                  worked_hours: '',
                  is_late: false,
                  remarks: '',
                  leave_type: '',
                });
              }}
            >
              Cancel
            </button>
          )}
        </form>

        <h2>Attendance Records</h2>
        <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Employee</th>
              <th>Department</th>
              <th>Job Title</th>
              <th>Date</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Status</th>
              <th>Check-in Location</th>
              <th>Check-out Location</th>
              <th>Worked Hours</th>
              <th>Late</th>
              <th>Remarks</th>
              <th>Leave Type</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {attendance.length === 0 && (
              <tr>
                <td colSpan="15">No attendance records found</td>
              </tr>
            )}
            {attendance.map((rec) => {
              const emp = employeeMap[rec.employee_id] || {};
              return (
                <tr key={rec.id}>
                  <td>{rec.id}</td>
                  <td>{emp.name || `ID: ${rec.employee_id}`}</td>
                  <td>{emp.department || '-'}</td>
                  <td>{emp.job_title || '-'}</td>
                  <td>{rec.date}</td>
                  <td>{rec.check_in}</td>
                  <td>{rec.check_out}</td>
                  <td>{rec.status}</td>
                  <td>{rec.check_in_location}</td>
                  <td>{rec.check_out_location}</td>
                  <td>{rec.worked_hours}</td>
                  <td>{rec.is_late ? 'Yes' : 'No'}</td>
                  <td>{rec.remarks}</td>
                  <td>{rec.leave_type || '-'}</td>
                  <td>
                    <button onClick={() => handleEdit(rec)}>Edit</button>
                    <button onClick={() => handleDelete(rec.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Attendance;
