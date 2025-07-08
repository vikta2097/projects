const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../auth');
const { updateAttendanceForLeave } = require('../utils/attendanceUtils');
const { sendNotificationDirect, NOTIFICATION_TYPES, PRIORITY_LEVELS } = require('./notifications');

// Get all leaves (admin view)
router.get('/', verifyToken, (req, res) => {
  const sql = `
    SELECT lr.*, e.name as employee_name
    FROM leave_requests lr 
    JOIN employees e ON lr.employee_id = e.id 
    ORDER BY lr.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching leaves' });
    res.json(results);
  });
});

// Get leaves for the currently authenticated employee
router.get('/mine', verifyToken, (req, res) => {
  db.query('SELECT id FROM employees WHERE user_id = ?', [req.user.id], (err, employeeResults) => {
    if (err) return res.status(500).json({ message: 'Error finding employee record' });
    if (employeeResults.length === 0) {
      return res.status(404).json({ message: 'No employee record found for this user' });
    }
    const employeeId = employeeResults[0].id;
    db.query(
      'SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY created_at DESC',
      [employeeId],
      (err, results) => {
        if (err) return res.status(500).json({ message: 'Failed to fetch leaves' });
        res.json(results);
      }
    );
  });
});

// Apply for a new leave (employee)
router.post('/', verifyToken, (req, res) => {
  const { leaveType, startDate, endDate, reason } = req.body;

  if (!leaveType || !startDate || !endDate) {
    return res.status(400).json({ message: 'Leave type, start date, and end date are required' });
  }

  db.query('SELECT id, user_id FROM employees WHERE user_id = ?', [req.user.id], (err, employeeResults) => {
    if (err) return res.status(500).json({ message: 'Error finding employee record' });
    if (employeeResults.length === 0) {
      return res.status(404).json({ message: 'No employee record found for this user' });
    }

    const employeeId = employeeResults[0].id;
    const userId = employeeResults[0].user_id;

    db.query(
      'INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?)', 
      [employeeId, leaveType, startDate, endDate, reason],
      async (err, result) => {
        if (err) return res.status(500).json({ message: 'Failed to apply for leave' });

        // ✅ Send notification to correct user ID
        try {
          await sendNotificationDirect({
            userId,
            title: 'Leave Application Submitted',
            message: `Your leave request from ${startDate} to ${endDate} has been submitted.`,
            type: NOTIFICATION_TYPES.INFO,
            priority: PRIORITY_LEVELS.MEDIUM,
          });
        } catch (notifyErr) {
          console.error('Failed to send leave application notification:', notifyErr);
        }

        res.status(201).json({ message: 'Leave application successfully submitted!', id: result.insertId });
      }
    );
  });
});

// Update leave status (admin)
router.put('/:id/status', verifyToken, (req, res) => {
  const { id } = req.params;
  let { status } = req.body;

  if (!status) return res.status(400).json({ message: 'Status is required' });
  status = status.toLowerCase();
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  db.query(
    'UPDATE leave_requests SET status = ?, updated_at = NOW() WHERE id = ?',
    [status, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Error updating leave status' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Leave request not found' });

      // Fetch leave + employee info for notification and attendance
      db.query('SELECT employee_id, start_date, end_date, leave_type FROM leave_requests WHERE id = ?', [id], async (err, leaveRows) => {
        if (err) return res.status(500).json({ message: 'Error fetching leave details' });
        if (leaveRows.length === 0) return res.status(404).json({ message: 'Leave request not found' });

        const { employee_id, start_date, end_date, leave_type } = leaveRows[0];

        // Get user_id from employees table
        db.query('SELECT user_id FROM employees WHERE id = ?', [employee_id], async (err, employeeInfo) => {
          if (err || employeeInfo.length === 0) {
            return res.status(500).json({ message: 'Could not resolve user for notification' });
          }

          const userId = employeeInfo[0].user_id;

          // ✅ Send status notification
          try {
            await sendNotificationDirect({
              userId,
              title: `Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
              message: `Your leave request from ${start_date} to ${end_date} has been ${status}.`,
              type: status === 'approved' ? NOTIFICATION_TYPES.ALERT : NOTIFICATION_TYPES.INFO,
              priority: status === 'approved' ? PRIORITY_LEVELS.HIGH : PRIORITY_LEVELS.MEDIUM,
            });
          } catch (notifyErr) {
            console.error('Failed to send leave status notification:', notifyErr);
          }

          // If approved, update attendance
          if (status === 'approved') {
            try {
              await updateAttendanceForLeave(employee_id, start_date, end_date, leave_type);
              return res.json({ message: 'Leave approved and attendance updated' });
            } catch (err) {
              return res.status(500).json({ message: 'Leave approved, but attendance update failed' });
            }
          }

          res.json({ message: `Leave status updated to ${status}` });
        });
      });
    }
  );
});

// Delete leave request
router.delete('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM leave_requests WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error deleting leave request' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Leave request not found' });
    res.json({ message: 'Leave request deleted successfully' });
  });
});

module.exports = router;
