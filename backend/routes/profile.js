const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../auth');

// GET logged in user's profile
router.get('/', verifyToken, (req, res) => {
  const userId = req.user.id;

  const sql = `
    SELECT u.fullname, u.email, u.role, e.department, e.job_title, e.phone, e.address, e.status, e.date_of_hire
    FROM usercredentials u
    LEFT JOIN employees e ON u.id = e.user_id
    WHERE u.id = ?
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (results.length === 0) return res.status(404).json({ message: 'Profile not found' });

    res.json(results[0]);
  });
});

// Update logged in user's phone and address only
router.put('/', verifyToken, (req, res) => {
  const userId = req.user.id;
  const { phone, address } = req.body;

  if (!phone || !address) {
    return res.status(400).json({ message: 'Phone and address are required' });
  }

  const sql = `
    UPDATE employees
    SET phone = ?, address = ?
    WHERE user_id = ?
  `;

  db.query(sql, [phone, address, userId], (err, result) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Employee profile not found' });

    res.json({ phone, address });
  });
});

module.exports = router;
