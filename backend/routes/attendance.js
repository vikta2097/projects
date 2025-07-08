const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../auth');
const { sendNotificationDirect, NOTIFICATION_TYPES, PRIORITY_LEVELS } = require('./notifications');

// Utility function to update attendance for leave days
const updateAttendanceForLeave = async (employee_id, start_date, end_date, leave_type) => {
  const dayMs = 24 * 60 * 60 * 1000;
  const start = new Date(start_date);
  const end = new Date(end_date);

  for (let dt = start; dt <= end; dt = new Date(dt.getTime() + dayMs)) {
    const dateStr = dt.toISOString().split('T')[0];

    const sql = `
      INSERT INTO attendance (employee_id, date, status, leave_type)
      VALUES (?, ?, 'leave', ?)
      ON DUPLICATE KEY UPDATE status='leave', leave_type=VALUES(leave_type)
    `;

    await new Promise((resolve, reject) => {
      db.query(sql, [employee_id, dateStr, leave_type], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  }
};

// Get all attendance records
router.get('/', verifyToken, (req, res) => {
  db.query('SELECT * FROM attendance ORDER BY date DESC', (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching attendance' });
    res.json(results);
  });
});

// Add or update attendance record
router.post('/', verifyToken, async (req, res) => {
  const {
    employee_id, date, check_in, check_out, status,
    check_in_location, check_out_location, worked_hours,
    is_late, remarks, leave_type
  } = req.body;

  if (!employee_id || !date) {
    return res.status(400).json({ message: 'Employee ID and date required' });
  }

  const validStatuses = ['present', 'absent', 'leave', 'holiday'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  try {
    const sql = `
      INSERT INTO attendance
      (employee_id, date, check_in, check_out, status, check_in_location, check_out_location, worked_hours, is_late, remarks, leave_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        check_in = VALUES(check_in),
        check_out = VALUES(check_out),
        status = VALUES(status),
        check_in_location = VALUES(check_in_location),
        check_out_location = VALUES(check_out_location),
        worked_hours = VALUES(worked_hours),
        is_late = VALUES(is_late),
        remarks = VALUES(remarks),
        leave_type = VALUES(leave_type)
    `;

    db.query(sql, [
      employee_id, date, check_in, check_out, status,
      check_in_location, check_out_location, worked_hours,
      is_late ? 1 : 0, remarks, leave_type
    ], async (err, result) => {
      if (err) {
        console.error('Error inserting attendance:', err);
        return res.status(500).json({ message: 'Error inserting attendance' });
      }

      // Send notification to employee about attendance recorded
      try {
        await sendNotificationDirect({
          userId: employee_id,
          title: 'Attendance Recorded',
          message: `Your attendance for ${date} has been marked as ${status}.`,
          type: NOTIFICATION_TYPES.INFO,
          priority: PRIORITY_LEVELS.MEDIUM,
        });
      } catch (notifyErr) {
        console.error('Failed to send attendance notification:', notifyErr);
      }

      res.status(201).json({ message: 'Attendance recorded', id: result.insertId });
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Update attendance record by ID
router.put('/:id', verifyToken, (req, res) => {
  const id = req.params.id;
  const {
    employee_id, date, check_in, check_out, status,
    check_in_location, check_out_location, worked_hours,
    is_late, remarks, leave_type
  } = req.body;

  if (!employee_id || !date) return res.status(400).json({ message: 'Employee ID and date required' });

  const sql = `
    UPDATE attendance SET
    employee_id = ?, date = ?, check_in = ?, check_out = ?, status = ?,
    check_in_location = ?, check_out_location = ?, worked_hours = ?, is_late = ?, remarks = ?, leave_type = ?
    WHERE id = ?
  `;
  db.query(sql, [
    employee_id, date, check_in, check_out, status,
    check_in_location, check_out_location, worked_hours,
    is_late ? 1 : 0, remarks, leave_type, id
  ], async (err, result) => {
    if (err) return res.status(500).json({ message: 'Error updating attendance' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Attendance not found' });

    // Send notification to employee about attendance update
    try {
      await sendNotificationDirect({
        userId: employee_id,
        title: 'Attendance Updated',
        message: `Your attendance on ${date} was updated to status: ${status}.`,
        type: NOTIFICATION_TYPES.INFO,
        priority: PRIORITY_LEVELS.MEDIUM,
      });
    } catch (notifyErr) {
      console.error('Failed to send attendance update notification:', notifyErr);
    }

    res.json({ message: 'Attendance updated' });
  });
});

// Delete attendance record by ID
router.delete('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM attendance WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error deleting attendance' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Attendance not found' });
    res.json({ message: 'Attendance deleted' });
  });
});

// Get today's attendance
router.get('/today', verifyToken, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  db.query('SELECT * FROM attendance WHERE date = ?', [today], (err, results) => {
    if (err) return res.status(500).json({ message: "Error fetching today's attendance" });
    res.json(results);
  });
});

// Mark attendance for logged-in user (check-in)
router.post('/mine', verifyToken, (req, res) => {
  const userId = req.user.id;
  const { check_in_location } = req.body;

  const currentTime = new Date();
  const checkIn = currentTime.toTimeString().slice(0, 5); // "HH:mm"
  const formattedDate = currentTime.toISOString().split('T')[0];

  db.query('SELECT id FROM employees WHERE user_id = ?', [userId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(400).json({ message: 'Employee profile not found' });
    }

    const employee_id = results[0].id;
    const isLate = checkIn > '08:00'; // example cutoff time

    const sql = `
      INSERT INTO attendance
      (employee_id, date, check_in, status, check_in_location, is_late)
      VALUES (?, ?, ?, 'present', ?, ?)
      ON DUPLICATE KEY UPDATE
        check_in = VALUES(check_in),
        check_in_location = VALUES(check_in_location),
        is_late = VALUES(is_late)
    `;

    db.query(sql, [employee_id, formattedDate, checkIn, check_in_location, isLate ? 1 : 0], async (err) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to mark attendance' });
      }

      // Notify user about successful check-in
      try {
        await sendNotificationDirect({
          userId: userId,
          title: 'Attendance Check-in Successful',
          message: `You checked in at ${checkIn} on ${formattedDate}.`,
          type: NOTIFICATION_TYPES.INFO,
          priority: PRIORITY_LEVELS.MEDIUM,
        });
      } catch (notifyErr) {
        console.error('Failed to send check-in notification:', notifyErr);
      }

      res.status(201).json({ message: 'Attendance marked' });
    });
  });
});

// Get recent attendance for logged-in user (last 7 days)
router.get('/mine/recent', verifyToken, (req, res) => {
  const userId = req.user.id;
  db.query('SELECT id FROM employees WHERE user_id = ?', [userId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(400).json({ message: 'Employee not found' });
    }
    const employeeId = results[0].id;
    db.query('SELECT * FROM attendance WHERE employee_id = ? ORDER BY date DESC LIMIT 7', [employeeId], (err, rows) => {
      if (err) return res.status(500).json({ message: 'Error fetching attendance' });
      res.json(rows);
    });
  });
});

module.exports = router;
