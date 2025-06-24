const db = require('../db');

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

module.exports = { updateAttendanceForLeave };

