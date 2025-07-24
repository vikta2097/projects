const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../auth');
const { sendNotificationDirect, NOTIFICATION_TYPES, PRIORITY_LEVELS } = require('./notifications');

// ----- ADMIN ROUTES -----

// Get all attendance records
router.get('/', verifyToken, (req, res) => {
  db.query('SELECT * FROM attendance ORDER BY date DESC', (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching attendance' });
    res.json(results);
  });
});

// Get employees list for dropdown
router.get('/employees', verifyToken, (req, res) => {
  db.query('SELECT id, name, department, job_title FROM employees', (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching employees' });
    res.json(results);
  });
});

// Add attendance (admin)
router.post('/', verifyToken, (req, res) => {
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

  const sql = `
    INSERT INTO attendance
    (employee_id, date, check_in, check_out, status, check_in_location, check_out_location, worked_hours, is_late, remarks, leave_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      check_in=VALUES(check_in),
      check_out=VALUES(check_out),
      status=VALUES(status),
      check_in_location=VALUES(check_in_location),
      check_out_location=VALUES(check_out_location),
      worked_hours=VALUES(worked_hours),
      is_late=VALUES(is_late),
      remarks=VALUES(remarks),
      leave_type=VALUES(leave_type)
  `;

  db.query(sql, [
    employee_id, date, check_in, check_out, status,
    check_in_location, check_out_location, worked_hours,
    is_late ? 1 : 0, remarks, leave_type
  ], async (err, result) => {
    if (err) return res.status(500).json({ message: 'Error inserting attendance' });

    // Notify employee
    await sendNotificationDirect({
      userId: employee_id,
      title: 'Attendance Recorded',
      message: `Your attendance for ${date} was recorded with status: ${status}.`,
      type: NOTIFICATION_TYPES.INFO,
      priority: PRIORITY_LEVELS.MEDIUM,
    });

    // Notify admin (current user)
    await sendNotificationDirect({
      userId: req.user.id,
      title: 'Attendance Recorded',
      message: `Attendance recorded for employee ${employee_id} on ${date}.`,
      type: NOTIFICATION_TYPES.LOG,
      priority: PRIORITY_LEVELS.LOW,
    });

    res.status(201).json({ message: 'Attendance recorded', id: result.insertId });
  });
});

// Update attendance record (admin)
router.put('/:id', verifyToken, (req, res) => {
  const id = req.params.id;
  const {
    employee_id, date, check_in, check_out, status,
    check_in_location, check_out_location, worked_hours,
    is_late, remarks, leave_type
  } = req.body;

  if (!employee_id || !date) {
    return res.status(400).json({ message: 'Employee ID and date required' });
  }

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

    // Notify employee
    await sendNotificationDirect({
      userId: employee_id,
      title: 'Attendance Updated',
      message: `Your attendance on ${date} was updated to status: ${status}.`,
      type: NOTIFICATION_TYPES.INFO,
      priority: PRIORITY_LEVELS.MEDIUM,
    });

    // Notify admin (current user)
    await sendNotificationDirect({
      userId: req.user.id,
      title: 'Attendance Updated',
      message: `Attendance for employee ${employee_id} on ${date} updated.`,
      type: NOTIFICATION_TYPES.LOG,
      priority: PRIORITY_LEVELS.LOW,
    });

    res.json({ message: 'Attendance updated' });
  });
});

// Delete attendance record (admin)
router.delete('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM attendance WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error deleting attendance' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Attendance not found' });
    res.json({ message: 'Attendance deleted' });
  });
});

// ----- EMPLOYEE ROUTES -----

// Check if employee marked attendance for a given date
router.get('/mine', verifyToken, (req, res) => {
  const userId = req.user.id;
  const date = req.query.date;
  if (!date) return res.status(400).json({ message: 'Date query parameter required' });

  db.query('SELECT id FROM employees WHERE user_id = ?', [userId], (err, results) => {
    if (err || results.length === 0) return res.status(400).json({ message: 'Employee profile not found' });
    const employee_id = results[0].id;

    db.query(
      'SELECT check_in FROM attendance WHERE employee_id = ? AND date = ?',
      [employee_id, date],
      (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error checking attendance' });
        if (rows.length > 0) {
          res.json({ marked: true, check_in: rows[0].check_in });
        } else {
          res.json({ marked: false });
        }
      }
    );
  });
});

// Employee marks attendance (check-in)
router.post('/mine', verifyToken, (req, res) => {
  const userId = req.user.id;
  const { check_in_location } = req.body;
  const currentTime = new Date();
  const checkIn = currentTime.toTimeString().slice(0, 5);
  const formattedDate = currentTime.toISOString().split('T')[0];

  db.query('SELECT id FROM employees WHERE user_id = ?', [userId], (err, results) => {
    if (err || results.length === 0) return res.status(400).json({ message: 'Employee profile not found' });

    const employee_id = results[0].id;
    const isLate = checkIn > '08:00';

    // Check if employee is on leave today
    const leaveCheck = `
      SELECT * FROM leave_requests
      WHERE employee_id = ? AND status = 'approved'
      AND ? BETWEEN start_date AND end_date
    `;
    db.query(leaveCheck, [employee_id, formattedDate], (err, leaveResults) => {
      if (err) return res.status(500).json({ message: 'Leave check failed' });
      if (leaveResults.length > 0) {
        return res.status(403).json({ message: 'You are on leave today. Attendance not required.' });
      }

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

        // Notify user
        await sendNotificationDirect({
          userId: userId,
          title: 'Attendance Check-in Successful',
          message: `You checked in at ${checkIn} on ${formattedDate}.`,
          type: NOTIFICATION_TYPES.INFO,
          priority: PRIORITY_LEVELS.MEDIUM,
        });

        if (isLate) {
          await sendNotificationDirect({
            userId: userId,
            title: 'Late Check-in',
            message: `You checked in late at ${checkIn}.`,
            type: NOTIFICATION_TYPES.WARNING,
            priority: PRIORITY_LEVELS.HIGH,
          });
        }

        res.status(201).json({ message: 'Attendance marked' });
      });
    });
  });
});

// Employee checks out
router.post('/mine/checkout', verifyToken, (req, res) => {
  const userId = req.user.id;
  const { check_out_location } = req.body;
  const currentTime = new Date();
  const checkOut = currentTime.toTimeString().slice(0, 5);
  const formattedDate = currentTime.toISOString().split('T')[0];

  db.query('SELECT id FROM employees WHERE user_id = ?', [userId], (err, results) => {
    if (err || results.length === 0) return res.status(400).json({ message: 'Employee profile not found' });

    const employee_id = results[0].id;

    const updateSql = `
      UPDATE attendance
      SET check_out = ?, 
          check_out_location = ?, 
          worked_hours = TIMESTAMPDIFF(
            MINUTE,
            STR_TO_DATE(CONCAT(date, ' ', check_in), '%Y-%m-%d %H:%i:%s'),
            STR_TO_DATE(CONCAT(date, ' ', ?), '%Y-%m-%d %H:%i:%s')
          ) / 60
      WHERE employee_id = ? AND date = ?
    `;

    db.query(updateSql, [checkOut, check_out_location, checkOut, employee_id, formattedDate], async (err, result) => {
      if (err) {
        console.error('Checkout error:', err);  // Add error logging for debugging
        return res.status(500).json({ message: 'Failed to check out' });
      }

      await sendNotificationDirect({
        userId,
        title: 'Checked Out',
        message: `You checked out at ${checkOut} on ${formattedDate}.`,
        type: NOTIFICATION_TYPES.INFO,
        priority: PRIORITY_LEVELS.MEDIUM,
      });

      res.json({ message: 'Check-out successful' });
    });
  });
});


// Get recent attendance for logged-in employee
router.get('/mine/recent', verifyToken, (req, res) => {
  const userId = req.user.id;
  db.query('SELECT id FROM employees WHERE user_id = ?', [userId], (err, results) => {
    if (err || results.length === 0) return res.status(400).json({ message: 'Employee not found' });
    const employeeId = results[0].id;
    db.query('SELECT * FROM attendance WHERE employee_id = ? ORDER BY date DESC LIMIT 7', [employeeId], (err, rows) => {
      if (err) return res.status(500).json({ message: 'Error fetching attendance' });
      res.json(rows);
    });
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

module.exports = router;
