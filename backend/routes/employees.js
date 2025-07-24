const express = require('express');
const router = express.Router();
const db = require('../db');


const { verifyToken } = require('../auth'); // Adjust path as needed

router.get('/me', verifyToken, (req, res) => {
  const userId = req.user.id; // from JWT token after verification

  const sql = 'SELECT * FROM employees WHERE user_id = ?';
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching employee record' });
    if (results.length === 0) return res.status(404).json({ message: 'Employee record not found' });
    res.json(results[0]);
  });
});

// Get all employees with user info
router.get('/', (req, res) => {
  const query = `SELECT e.*, u.email, u.fullname FROM employees e JOIN usercredentials u ON e.user_id = u.id`;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching employees' });
    res.json(results);
  });
});

// Add new employee
router.post('/', (req, res) => {
  const { user_id, name, department, job_title, date_of_hire, phone, address, status } = req.body;
  if (!user_id || !department || !job_title || !date_of_hire || !phone || !address || !status) {
    return res.status(400).json({ message: 'Required fields missing' });
  }

  db.query('SELECT * FROM employees WHERE user_id = ?', [user_id], (err, existing) => {
    if (err) return res.status(500).json({ message: 'Error checking employee linkage' });
    if (existing.length > 0) return res.status(400).json({ message: 'User already linked to employee' });

    const insertEmployee = (finalName) => {
      const sql = `
        INSERT INTO employees (user_id, name, department, job_title, date_of_hire, phone, address, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.query(sql, [user_id, finalName, department, job_title, date_of_hire, phone, address, status], (err, result) => {
        if (err) return res.status(500).json({ message: 'Error inserting employee' });
        res.status(201).json({ message: 'Employee added', id: result.insertId });
      });
    };

    if (!name) {
      db.query('SELECT fullname FROM usercredentials WHERE id = ?', [user_id], (err, result) => {
        if (err || result.length === 0) return res.status(400).json({ message: 'User not found' });
        insertEmployee(result[0].fullname);
      });
    } else {
      insertEmployee(name);
    }
  });
});

// Update employee
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { user_id, name, department, job_title, date_of_hire, phone, address, status } = req.body;
  if (!user_id || !name || !department || !job_title || !date_of_hire || !phone || !address || !status) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  db.query('SELECT * FROM employees WHERE user_id = ? AND id != ?', [user_id, id], (err, existing) => {
    if (err) return res.status(500).json({ message: 'Error checking duplicate user' });
    if (existing.length > 0) return res.status(400).json({ message: 'Another employee already linked to this user' });

    const sql = `
      UPDATE employees SET user_id = ?, name = ?, department = ?, job_title = ?, date_of_hire = ?, phone = ?, address = ?, status = ?
      WHERE id = ?
    `;
    db.query(sql, [user_id, name, department, job_title, date_of_hire, phone, address, status, id], (err, result) => {
      if (err) return res.status(500).json({ message: 'Error updating employee' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Employee not found' });
      res.json({ message: 'Employee updated' });
    });
  });
});

// Delete employee
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM employees WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error deleting employee' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Employee not found' });
    res.json({ message: 'Employee deleted' });
  });
});

// Get users not linked to employees
router.get('/unlinked-users', (req, res) => {
  const sql = `
    SELECT u.id, u.fullname, u.email
    FROM usercredentials u
    LEFT JOIN employees e ON u.id = e.user_id
    WHERE e.user_id IS NULL
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching unlinked users' });
    res.json(results);
  });
});

module.exports = router;
