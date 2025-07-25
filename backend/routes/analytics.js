const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../auth');

// Utility function to wrap queries in a Promise
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

router.get('/summary', verifyToken, async (req, res) => {
  try {
    const totalAttendanceRows = await query(`SELECT COUNT(*) as total FROM attendance`);
    const totalRecords = totalAttendanceRows[0]?.total || 0;

    const lateCountRows = await query(`
      SELECT COUNT(*) as lateCount
      FROM attendance
      WHERE TIME(check_in) > '09:15:00'
    `);
    const lateCount = lateCountRows[0]?.lateCount || 0;

    const avgWorkedRows = await query(`
      SELECT ROUND(AVG(worked_hours), 2) as averageHours
      FROM attendance
      WHERE worked_hours IS NOT NULL
    `);
    const averageHours = avgWorkedRows[0]?.averageHours || 0;

    const totalLeaveRows = await query(`
      SELECT COUNT(*) as totalRequests
      FROM leave_requests
    `);
    const totalRequests = totalLeaveRows[0]?.totalRequests || 0;

    const commonLeaveTypeRows = await query(`
      SELECT leave_type, COUNT(*) as count
      FROM leave_requests
      GROUP BY leave_type
      ORDER BY count DESC
      LIMIT 1
    `);
    const mostCommonType = commonLeaveTypeRows[0]?.leave_type || 'N/A';

    const topRequesterRows = await query(`
      SELECT e.name, COUNT(*) as leave_count
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      GROUP BY e.name
      ORDER BY leave_count DESC
      LIMIT 1
    `);
    const topRequester = topRequesterRows[0]?.name || 'N/A';

    const leaveTypesRows = await query(`
      SELECT leave_type, COUNT(*) as count
      FROM leave_requests
      GROUP BY leave_type
    `);

    const leaveTypeBreakdown = {};
    leaveTypesRows.forEach(row => {
      leaveTypeBreakdown[row.leave_type] = row.count;
    });

    res.json({
      attendance: {
        totalRecords,
        lateCount,
        averageHours,
      },
      leave: {
        totalRequests,
        mostCommonType,
        topRequester,
        leaveTypeBreakdown,
      },
    });
  } catch (err) {
    console.error('Error fetching analytics summary:', err);
    res.status(500).json({ error: 'Failed to fetch analytics summary' });
  }
});

module.exports = router;
