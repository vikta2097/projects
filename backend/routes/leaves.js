const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../auth');
const { updateAttendanceForLeave } = require('../utils/attendanceUtils');
const { sendNotificationDirect, NOTIFICATION_TYPES, PRIORITY_LEVELS } = require('./notifications');

// Helper: Notify all admins about an event
async function notifyAllAdmins(title, message, type = NOTIFICATION_TYPES.ALERT, priority = PRIORITY_LEVELS.HIGH) {
  return new Promise((resolve, reject) => {
    db.query('SELECT id FROM usercredentials WHERE role = "admin"', async (err, admins) => {
      if (err) {
        console.error('Failed to fetch admins for notification:', err);
        return reject(err);
      }
      try {
        for (const admin of admins) {
          await sendNotificationDirect({
            userId: admin.id,
            title,
            message,
            type,
            priority,
          });
        }
        resolve();
      } catch (e) {
        console.error('Failed to send notification to admins:', e);
        reject(e);
      }
    });
  });
}

// ---------------------------------------
// ADMIN ROUTES
// ---------------------------------------

// GET /api/leaves
router.get('/', verifyToken, (req, res) => {
  const statusFilter = req.query.status;
  let sql = `
    SELECT lr.*, e.name AS employee_name
    FROM leave_requests lr
    JOIN employees e ON lr.employee_id = e.id
  `;
  const params = [];

  if (statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter.toLowerCase())) {
    sql += ' WHERE lr.status = ?';
    params.push(statusFilter.toLowerCase());
  }

  sql += ' ORDER BY lr.created_at DESC';

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching leaves' });
    res.json(results);
  });
});

// PUT /api/leaves/:id/status
router.put('/:id/status', verifyToken, async (req, res) => {
  const { id } = req.params;
  let { status } = req.body;

  if (!['pending', 'approved', 'rejected'].includes((status || '').toLowerCase()))
    return res.status(400).json({ message: 'Invalid status' });

  status = status.toLowerCase();

  db.query('UPDATE leave_requests SET status = ?, updated_at = NOW() WHERE id = ?', [status, id], (err, result) => {
    if (err || result.affectedRows === 0)
      return res.status(500).json({ message: 'Error updating status' });

    db.query('SELECT employee_id, start_date, end_date, leave_type FROM leave_requests WHERE id = ?', [id], (err, leaveRows) => {
      if (err || leaveRows.length === 0)
        return res.status(500).json({ message: 'Leave not found' });

      const { employee_id, start_date, end_date, leave_type } = leaveRows[0];

      db.query('SELECT user_id, name FROM employees WHERE id = ?', [employee_id], async (err, userRows) => {
        if (err || userRows.length === 0)
          return res.status(500).json({ message: 'User not found' });

        const userId = userRows[0].user_id;
        const employeeName = userRows[0].name || 'Employee';

        try {
          await sendNotificationDirect({
            userId,
            title: `Leave ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            message: `Your leave request from ${start_date.toISOString().split('T')[0]} to ${end_date.toISOString().split('T')[0]} was ${status}.`,
            type: status === 'approved' ? NOTIFICATION_TYPES.ALERT : NOTIFICATION_TYPES.INFO,
            priority: status === 'approved' ? PRIORITY_LEVELS.HIGH : PRIORITY_LEVELS.MEDIUM,
          });

          await notifyAllAdmins(
            `Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            `Leave request from ${employeeName} (${start_date.toISOString().split('T')[0]} to ${end_date.toISOString().split('T')[0]}) was ${status}.`,
            status === 'approved' ? NOTIFICATION_TYPES.ALERT : NOTIFICATION_TYPES.INFO,
            status === 'approved' ? PRIORITY_LEVELS.HIGH : PRIORITY_LEVELS.MEDIUM
          );

          if (status === 'approved') {
            await updateAttendanceForLeave(employee_id, start_date, end_date, leave_type);
          }
        } catch (notifyErr) {
          console.error('Notification error:', notifyErr);
        }

        res.json({ message: `Leave ${status}` });
      });
    });
  });
});

// PUT /api/leaves/:id/days
router.put('/:id/days', verifyToken, (req, res) => {
  const { id } = req.params;
  let { days } = req.body;
  days = Number(days);
  if (isNaN(days) || days < 0) return res.status(400).json({ message: 'Invalid days value' });

  db.query('UPDATE leave_requests SET days = ?, updated_at = NOW() WHERE id = ?', [days, id], (err, result) => {
    if (err || result.affectedRows === 0)
      return res.status(500).json({ message: 'Failed to update days' });
    res.json({ message: 'Days updated' });
  });
});

// DELETE /api/leaves/:id
router.delete('/:id', verifyToken, (req, res) => {
  const { id } = req.params;

  db.query('SELECT lr.employee_id, u.role, e.user_id FROM leave_requests lr JOIN employees e ON lr.employee_id = e.id JOIN usercredentials u ON u.id = ? WHERE lr.id = ?', [req.user.id, id], (err, rows) => {
    if (err || rows.length === 0)
      return res.status(404).json({ message: 'Leave request not found or access denied' });

    const leaveOwnerId = rows[0].user_id;
    const userRole = rows[0].role;

    if (req.user.id !== leaveOwnerId && userRole !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this leave request' });
    }

    db.query('DELETE FROM leave_requests WHERE id = ?', [id], (err2, result) => {
      if (err2 || result.affectedRows === 0)
        return res.status(500).json({ message: 'Error deleting leave request' });
      res.json({ message: 'Leave request deleted' });
    });
  });
});

// GET /api/leaves/today
router.get('/today', verifyToken, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  db.query(`
    SELECT lr.*, e.name AS employee_name
    FROM leave_requests lr
    JOIN employees e ON lr.employee_id = e.id
    WHERE ? BETWEEN lr.start_date AND lr.end_date AND lr.status = 'approved'
    ORDER BY lr.start_date ASC
  `, [today], (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching today\'s leaves' });
    res.json(results);
  });
});

// GET /api/leave_limits
router.get('/leave_limits', verifyToken, (req, res) => {
  db.query(`
    SELECT ell.*, e.name AS employee_name
    FROM employee_leave_limits ell
    JOIN employees e ON ell.employee_id = e.id
  `, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch leave limits' });
    res.json(results);
  });
});

// ---------------------------------------
// EMPLOYEE ROUTES
// ---------------------------------------

{/* // GET /api/leaves/mine
router.get('/mine', verifyToken, (req, res) => {
  db.query('SELECT id FROM employees WHERE user_id = ?', [req.user.id], (err, employeeResults) => {
    if (err || employeeResults.length === 0)
      return res.status(404).json({ message: 'Employee not found' });

    const employeeId = employeeResults[0].id;
    db.query('SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY created_at DESC', [employeeId], (err, results) => {
      if (err) return res.status(500).json({ message: 'Failed to fetch leaves' });
      res.json(results);
    });
  });
}); */}

// GET /api/leaves/my
router.get('/my', verifyToken, (req, res) => {
  db.query('SELECT id FROM employees WHERE user_id = ?', [req.user.id], (err, employeeResults) => {
    if (err || employeeResults.length === 0)
      return res.status(404).json({ message: 'Employee not found' });

    const employeeId = employeeResults[0].id;
    db.query('SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY created_at DESC', [employeeId], (err, results) => {
      if (err) return res.status(500).json({ message: 'Failed to fetch leaves' });
      res.json(results);
    });
  });
});

// POST /api/leaves
router.post('/', verifyToken, (req, res) => {
  const { leave_type, start_date, end_date, reason } = req.body;
  if (!leave_type || !start_date || !end_date) return res.status(400).json({ message: 'Required fields missing' });

  db.query('SELECT id, user_id, name FROM employees WHERE user_id = ?', [req.user.id], (err, employeeResults) => {
    if (err || employeeResults.length === 0)
      return res.status(404).json({ message: 'Employee not found' });

    const employeeId = employeeResults[0].id;
    const userId = employeeResults[0].user_id;
    const employeeName = employeeResults[0].name || 'Employee';

    const requestedDays = Math.floor((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24)) + 1;

    db.query('SELECT max_days FROM employee_leave_limits WHERE employee_id = ? AND leave_type = ?', [employeeId, leave_type], (err, limitRows) => {
      if (err) return res.status(500).json({ message: 'Error checking leave limits' });
      if (limitRows.length === 0) return res.status(400).json({ message: 'No leave limit set for this leave type' });

      const maxDays = limitRows[0].max_days;

      db.query(`
        SELECT COALESCE(SUM(DATEDIFF(end_date, start_date) + 1), 0) AS used_days
        FROM leave_requests
        WHERE employee_id = ? AND leave_type = ? AND status = 'approved'
      `, [employeeId, leave_type], (err, usedRows) => {
        if (err) return res.status(500).json({ message: 'Error checking used leave' });

        const usedDays = usedRows[0].used_days;
        const remaining = maxDays - usedDays;

        if (requestedDays > remaining) {
          return res.status(400).json({
            message: `Leave exceeds remaining balance. Requested: ${requestedDays}, Remaining: ${remaining}`
          });
        }

        db.query(`
          INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'pending', NOW(), NOW())
        `, [employeeId, leave_type, start_date, end_date, reason], async (err, result) => {
          if (err) return res.status(500).json({ message: 'Failed to apply for leave' });

          try {
            await sendNotificationDirect({
              userId,
              title: 'Leave Application Submitted',
              message: `Your leave request from ${start_date} to ${end_date} has been submitted.`,
              type: NOTIFICATION_TYPES.INFO,
              priority: PRIORITY_LEVELS.MEDIUM,
            });

            await notifyAllAdmins(
              'New Leave Request Submitted',
              `New leave request from ${employeeName} from ${start_date} to ${end_date}.`,
              NOTIFICATION_TYPES.ALERT,
              PRIORITY_LEVELS.HIGH
            );
          } catch (notifyErr) {
            console.error('Notification error:', notifyErr);
          }

          res.status(201).json({ message: 'Leave submitted', id: result.insertId });
        });
      });
    });
  });
});
// GET /api/leaves/balance
router.get('/balance', verifyToken, (req, res) => {
  db.query('SELECT id FROM employees WHERE user_id = ?', [req.user.id], (err, employeeResults) => {
    if (err || employeeResults.length === 0)
      return res.status(404).json({ message: 'Employee not found' });

    const employeeId = employeeResults[0].id;

    // Get admin-set leave limits for this employee
    db.query('SELECT leave_type, max_days FROM employee_leave_limits WHERE employee_id = ?', [employeeId], (err, limitRows) => {
      if (err) return res.status(500).json({ message: 'Failed to fetch leave limits' });

      // Get used leave days by leave_type for approved leaves
      db.query(`
        SELECT leave_type, SUM(DATEDIFF(end_date, start_date) + 1) AS used_days
        FROM leave_requests
        WHERE employee_id = ? AND status = 'approved'
        GROUP BY leave_type
      `, [employeeId], (err, usedRows) => {
        if (err) return res.status(500).json({ message: 'Failed to fetch used leave days' });

        const used = {};
        usedRows.forEach(row => {
          used[row.leave_type] = +row.used_days;
        });

        const maxLimits = {};
        const balances = {};

        limitRows.forEach(row => {
          maxLimits[row.leave_type] = +row.max_days;
          const usedDays = used[row.leave_type] || 0;
          balances[row.leave_type] = Math.max(0, row.max_days - usedDays);
        });

        res.json({
          maxLimits,
          used,
          balances,
        });
      });
    });
  });
});

// POST /api/leave_limits - add or update leave limit
router.post('/leave_limits', verifyToken, (req, res) => {
  const { employee_id, leave_type, max_days } = req.body;

  if (!employee_id || !leave_type || !max_days) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (isNaN(max_days) || max_days <= 0) {
    return res.status(400).json({ message: 'Max days must be a positive number' });
  }

  // Check if a leave limit already exists for this employee and leave type
  db.query(
    'SELECT * FROM employee_leave_limits WHERE employee_id = ? AND leave_type = ?',
    [employee_id, leave_type],
    (err, results) => {
      if (err) {
        console.error('DB error checking leave limits:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (results.length > 0) {
        // Update existing leave limit
        db.query(
          'UPDATE employee_leave_limits SET max_days = ? WHERE employee_id = ? AND leave_type = ?',
          [max_days, employee_id, leave_type],
          (err2) => {
            if (err2) {
              console.error('DB error updating leave limit:', err2);
              return res.status(500).json({ message: 'Failed to update leave limit' });
            }
            return res.json({ message: 'Leave limit updated' });
          }
        );
      } else {
        // Insert new leave limit
        db.query(
          'INSERT INTO employee_leave_limits (employee_id, leave_type, max_days) VALUES (?, ?, ?)',
          [employee_id, leave_type, max_days],
          (err2) => {
            if (err2) {
              console.error('DB error inserting leave limit:', err2);
              return res.status(500).json({ message: 'Failed to add leave limit' });
            }
            return res.json({ message: 'Leave limit added' });
          }
        );
      }
    }
  );
});

module.exports = router;
