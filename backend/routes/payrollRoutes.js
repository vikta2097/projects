const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../auth');

// Import notification helper from your notifications module
const { sendNotificationDirect, NOTIFICATION_TYPES, PRIORITY_LEVELS } = require('./notifications'); 
// Adjust path if needed, e.g. '../routes/notifications'

// Helper: get total working days (exclude weekends) in month/year
function getWorkingDays(year, month) {
  let totalDays = new Date(year, month, 0).getDate(); // days in month
  let workingDays = 0;
  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
    if (dayOfWeek !== 0 && dayOfWeek !== 6) workingDays++;
  }
  return workingDays;
}

// POST /employee-salary
// Create or update salary details for an employee
router.post('/employee-salary', verifyToken, (req, res) => {
  const { employee_id, basic_salary, allowance, deduction_rate } = req.body;

  // Validate input
  if (
    !employee_id ||
    basic_salary == null || isNaN(basic_salary) || basic_salary < 0 ||
    allowance == null || isNaN(allowance) || allowance < 0 ||
    deduction_rate == null || isNaN(deduction_rate) || deduction_rate < 0 || deduction_rate > 100
  ) {
    return res.status(400).json({ message: 'Invalid input data' });
  }

  const sql = `
    INSERT INTO employee_salary (employee_id, basic_salary, allowance, deduction_rate)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      basic_salary = VALUES(basic_salary),
      allowance = VALUES(allowance),
      deduction_rate = VALUES(deduction_rate)
  `;

  const params = [employee_id, basic_salary, allowance, deduction_rate];

  db.query(sql, params, (err) => {
    if (err) {
      console.error('Error saving salary data:', err);
      return res.status(500).json({ message: 'Error saving salary data', error: err.message });
    }
    res.json({ message: 'Salary data saved successfully' });
  });
});

// POST /advance-payment
// Create advance payment for an employee
router.post('/advance-payment', verifyToken, (req, res) => {
  const { employee_id, amount, reason } = req.body;

  // Validate input
  if (!employee_id || !amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ message: 'Invalid input data' });
  }

  const sql = `
    INSERT INTO advance_payments (employee_id, amount, reason)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [employee_id, amount, reason], (err, result) => {
    if (err) {
      console.error('Error creating advance payment:', err);
      return res.status(500).json({ message: 'Error creating advance payment', error: err.message });
    }
    res.json({ message: 'Advance payment created successfully', id: result.insertId });
  });
});

// GET /advance-payments
// Get all advance payments (admin)
router.get('/advance-payments', verifyToken, (req, res) => {
  const sql = `
    SELECT ap.*, e.name AS employee_name
    FROM advance_payments ap
    JOIN employees e ON ap.employee_id = e.id
    ORDER BY ap.created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching advance payments', error: err.message });
    res.json(results);
  });
});

// GET /advance-payments/employee/:employee_id
// Get advance payments for a specific employee
router.get('/advance-payments/employee/:employee_id', verifyToken, (req, res) => {
  const empId = req.params.employee_id;

  const sql = `
    SELECT * FROM advance_payments
    WHERE employee_id = ?
    ORDER BY created_at DESC
  `;

  db.query(sql, [empId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching employee advance payments', error: err.message });
    res.json(results);
  });
});

// POST /generate
// Generate payroll for all employees for a given month/year and notify employees
router.post('/generate', verifyToken, async (req, res) => {
  const { month, year } = req.body;

  if (!month || !year) return res.status(400).json({ message: 'Month and year required' });

  const monthNum = parseInt(month);
  const yearNum = parseInt(year);

  if (monthNum < 1 || monthNum > 12) return res.status(400).json({ message: 'Invalid month' });
  if (yearNum < 2000 || yearNum > 2100) return res.status(400).json({ message: 'Invalid year' });

  const workingDays = getWorkingDays(yearNum, monthNum);
  const monthYear = `${String(monthNum).padStart(2, '0')}-${yearNum}`;

  const monthStart = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
  const monthEnd = `${yearNum}-${String(monthNum).padStart(2, '0')}-${new Date(yearNum, monthNum, 0).getDate()}`;

  try {
    // Step 1: Get employees with salary info
    const employees = await new Promise((resolve, reject) => {
      const sql = `
        SELECT e.id AS employee_id, e.user_id, es.basic_salary, es.allowance, es.deduction_rate
        FROM employees e
        LEFT JOIN employee_salary es ON e.id = es.employee_id
      `;
      db.query(sql, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (employees.length === 0) return res.status(404).json({ message: 'No employees found' });

    const payrollInserts = [];

    // Step 2: For each employee, calculate payroll
    for (const emp of employees) {
      const employeeId = emp.employee_id;
      const userId = emp.user_id;  // needed for notification
      const basicSalary = parseFloat(emp.basic_salary) || 0;
      const allowance = parseFloat(emp.allowance) || 0;
      const deductionRate = parseFloat(emp.deduction_rate) || 0;

      // Fetch attendance records
      const attendanceRecords = await new Promise((resolve, reject) => {
        const sql = `
          SELECT date, status
          FROM attendance
          WHERE employee_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
        `;
        db.query(sql, [employeeId, monthNum, yearNum], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      // Fetch approved leave requests overlapping the month
      const leaveDays = await new Promise((resolve, reject) => {
        const sql = `
          SELECT start_date, end_date
          FROM leave_requests
          WHERE employee_id = ?
            AND status = 'approved'
            AND (
              (start_date BETWEEN ? AND ?)
              OR (end_date BETWEEN ? AND ?)
              OR (start_date <= ? AND end_date >= ?)
            )
        `;
        db.query(sql, [employeeId, monthStart, monthEnd, monthStart, monthEnd, monthStart, monthEnd], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      // Fetch unpaid advance payments for this employee
      const advancePayments = await new Promise((resolve, reject) => {
        const sql = `
          SELECT id, amount
          FROM advance_payments
          WHERE employee_id = ? AND status = 'unpaid'
        `;
        db.query(sql, [employeeId], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      // Prepare set of leave dates for quick lookup
      const leaveDatesSet = new Set();
      leaveDays.forEach(ld => {
        let current = new Date(ld.start_date);
        const end = new Date(ld.end_date);
        while (current <= end) {
          leaveDatesSet.add(current.toISOString().slice(0, 10));
          current.setDate(current.getDate() + 1);
        }
      });

      const attendanceDatesSet = new Set(attendanceRecords.map(a => a.date.toISOString().slice(0, 10)));

      let absentDaysCount = 0;

      // Count explicit absents
      attendanceRecords.forEach(a => {
        if (a.status.toLowerCase() === 'absent') absentDaysCount++;
      });

      // Count missing attendance days that are working days and not on approved leave
      for (let day = 1; day <= new Date(yearNum, monthNum, 0).getDate(); day++) {
        const dateObj = new Date(yearNum, monthNum - 1, day);
        const dayOfWeek = dateObj.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends
        const dateStr = dateObj.toISOString().slice(0, 10);
        if (!attendanceDatesSet.has(dateStr) && !leaveDatesSet.has(dateStr)) {
          absentDaysCount++;
        }
      }

      // Calculate deductions
      const dailySalary = basicSalary / workingDays;
      const attendanceDeductions = deductionRate / 100 * dailySalary * absentDaysCount;
      
      // Calculate total advance payments to deduct
      const totalAdvancePayments = advancePayments.reduce((sum, ap) => sum + parseFloat(ap.amount), 0);
      
      // Total deductions = attendance deductions + advance payments
      const totalDeductions = attendanceDeductions + totalAdvancePayments;
      
      const netSalary = basicSalary + allowance - totalDeductions;

      payrollInserts.push([
        employeeId,
        monthNum,
        yearNum,
        basicSalary.toFixed(2),
        allowance.toFixed(2),
        totalDeductions.toFixed(2),
        netSalary.toFixed(2),
        new Date()
      ]);

      // Mark advance payments as deducted
      if (advancePayments.length > 0) {
        const advanceIds = advancePayments.map(ap => ap.id);
        await new Promise((resolve, reject) => {
          const sql = `
            UPDATE advance_payments
            SET status = 'deducted', paid_in_month = ?
            WHERE id IN (${advanceIds.map(() => '?').join(',')})
          `;
          db.query(sql, [monthYear, ...advanceIds], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    }

    // Insert or update payroll records
    const insertSQL = `
      INSERT INTO payroll
        (employee_id, month, year, basic_salary, allowances, deductions, net_salary, generated_at)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        basic_salary=VALUES(basic_salary),
        allowances=VALUES(allowances),
        deductions=VALUES(deductions),
        net_salary=VALUES(net_salary),
        generated_at=NOW()
    `;

    await new Promise((resolve, reject) => {
      db.query(insertSQL, [payrollInserts], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // --- SEND NOTIFICATIONS to each employee asynchronously ---
    for (const emp of employees) {
      try {
        await sendNotificationDirect({
          userId: emp.user_id,
          title: 'Payslip Generated',
          message: `Your payslip for ${String(monthNum).padStart(2,'0')}/${yearNum} has been generated and is ready for download.`,
          type: NOTIFICATION_TYPES.SYSTEM,
          priority: PRIORITY_LEVELS.HIGH,
          metadata: { month: monthNum, year: yearNum, employeeId: emp.employee_id }
        });
      } catch (notifError) {
        console.error(`Failed to send notification to user ${emp.user_id}:`, notifError);
      }
    }

    res.json({ message: 'Payroll generated and notifications sent successfully' });

  } catch (error) {
    console.error('Payroll generation error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /
// Get all payroll records (admin)
router.get('/', verifyToken, (req, res) => {
  const sql = `
    SELECT p.*, e.name 
    FROM payroll p
    JOIN employees e ON p.employee_id = e.id
    ORDER BY p.generated_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching payroll', error: err.message });
    res.json(results);
  });
});

// GET /employee/:employee_id
// Get all payroll records for a specific employee by employee_id
router.get('/employee/:employee_id', verifyToken, (req, res) => {
  const empId = req.params.employee_id;

  const sql = `
    SELECT * FROM payroll
    WHERE employee_id = ?
    ORDER BY generated_at DESC
  `;
  db.query(sql, [empId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching employee payroll', error: err.message });
    res.json(results);
  });
});

// GET /employee/user/:user_id
// Get all payroll records for a user by their user_id (joins to employees table)
router.get('/employee/user/:user_id', verifyToken, (req, res) => {
  const userId = req.params.user_id;

  const sql = `
    SELECT p.*, e.name AS employee_name
    FROM payroll p
    JOIN employees e ON p.employee_id = e.id
    WHERE e.user_id = ?
    ORDER BY p.generated_at DESC
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching payroll by user ID', error: err.message });
    res.json(results);
  });
});

// GET /payslip/:employee_id/:month/:year
// Get payroll payslip details for a given employee, month, and year
router.get('/payslip/:employee_id/:month/:year', verifyToken, (req, res) => {
  const { employee_id, month, year } = req.params;

  // Validate month/year
  const m = parseInt(month);
  const y = parseInt(year);
  if (m < 1 || m > 12 || y < 2000 || y > 2100) {
    return res.status(400).json({ message: 'Invalid month or year' });
  }

  const monthYear = `${String(m).padStart(2, '0')}-${y}`;

  const sql = `
    SELECT p.*, e.name, e.job_title, e.department
    FROM payroll p
    JOIN employees e ON p.employee_id = e.id
    WHERE p.employee_id = ? AND p.month = ? AND p.year = ?
  `;

  db.query(sql, [employee_id, m, y], (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching payslip', error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Payslip not found' });
    
    // Get advance payments deducted in this month
    const advanceSQL = `
      SELECT amount, reason
      FROM advance_payments
      WHERE employee_id = ? AND paid_in_month = ?
    `;
    
    db.query(advanceSQL, [employee_id, monthYear], (err, advanceResults) => {
      if (err) return res.status(500).json({ message: 'Error fetching advance payments', error: err.message });
      
      const payslip = results[0];
      payslip.advance_payments = advanceResults;
      
      res.json(payslip);
    });
  });
});

// Get all advance payments
router.get('/advance-payment', async (req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT * FROM advance_payments');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching advance payments:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
