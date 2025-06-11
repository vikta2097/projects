const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const db = require('./db');
const verifyToken = require('./auth');
require('dotenv').config();


router.get('/validate-token', verifyToken, (req, res) => {
  res.json({ valid: true });
});



// Helper: validate email format (simple regex)
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


// -------------------- AUTHENTICATION --------------------
router.post('/register', async (req, res) => {
  const { email, password, fullname } = req.body;

  // Basic validation
  if (!email || !password || !fullname) {
    return res.status(400).json({ message: 'Email, password, and fullname are required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    // Check if email already exists
    db.query('SELECT id FROM usercredentials WHERE email = ?', [email], async (err, results) => {
      if (err) {
        console.error('DB error during email check:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (results.length > 0) {
        return res.status(409).json({ message: 'Email already registered' });
      }

      // Insert user
      const hashedPassword = await bcrypt.hash(password, 10);
      const sql = 'INSERT INTO usercredentials (email, password, fullname) VALUES (?, ?, ?)';
      const values = [email, hashedPassword, fullname];

      db.query(sql, values, (err) => {
        if (err) {
          console.error('DB error during registration:', err);
          return res.status(500).json({ message: 'Registration failed' });
        }
        res.json({ message: 'User registered successfully' });
      });
    });
  } catch (err) {
    console.error('Unexpected registration error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  db.query('SELECT * FROM usercredentials WHERE email = ?', [email], async (err, results) => {
    if (err) {
      console.error('DB error during login:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    if (results.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = results[0];
    try {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

      const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ token });
    } catch (error) {
      console.error('Error comparing password:', error);
      res.status(500).json({ message: 'Login error' });
    }
  });
});

// Forgot password
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: 'Email is required' });

  // Check user exists first
  db.query('SELECT id FROM usercredentials WHERE email = ?', [email], (err, results) => {
    if (err) {
      console.error('DB error during forgot-password:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Email not found' });
    }

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '15m' });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: { rejectUnauthorized: false },
    });

    const resetLink = `http://localhost:3000/reset-password/${token}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Reset Your Password',
      html: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`,
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        console.error('Email sending error:', err);
        return res.status(500).json({ message: 'Failed to send email' });
      }
      res.json({ message: 'Reset link sent to email' });
    });
  });
});

// Reset password
router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query('UPDATE usercredentials SET password = ? WHERE email = ?', [hashedPassword, decoded.email], (err) => {
      if (err) {
        console.error('DB error during password reset:', err);
        return res.status(500).json({ message: 'Password reset failed' });
      }
      res.json({ message: 'Password reset successful' });
    });
  } catch (err) {
    console.error('Invalid or expired token:', err);
    res.status(400).json({ message: 'Invalid or expired token' });
  }
});


// -------------------- USERS --------------------

// Get all users
router.get('/users', verifyToken, (req, res) => {
  const query = 'SELECT id, email, fullname, role FROM usercredentials';
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching users' });
    res.json(results);
  });
});

// Create new user
router.post('/users', verifyToken, async (req, res) => {
  const { email, fullname, role, password } = req.body;
  if (!email || !fullname || !role || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query(
      'INSERT INTO usercredentials (email, fullname, role, password) VALUES (?, ?, ?, ?)',
      [email, fullname, role, hashedPassword],
      (err, result) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Email already registered' });
          return res.status(500).json({ message: 'Error creating user' });
        }
        res.status(201).json({ message: 'User created', id: result.insertId });
      }
    );
  } catch (error) {
    res.status(500).json({ message: 'Server error during user creation' });
  }
});

// Update user
router.put('/users/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { email, fullname, role, password } = req.body;

  if (!email || !fullname || !role) {
    return res.status(400).json({ message: 'Email, fullname, and role are required' });
  }

  try {
    const fields = [email, fullname, role];
    let query = 'UPDATE usercredentials SET email = ?, fullname = ?, role = ?';
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      fields.push(hashedPassword);
    }
    query += ' WHERE id = ?';
    fields.push(id);

    db.query(query, fields, (err, result) => {
      if (err) return res.status(500).json({ message: 'Error updating user' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
      res.json({ message: 'User updated' });
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during user update' });
  }
});

// Delete user
router.delete('/users/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM usercredentials WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error deleting user' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted' });
  });
});

// -------------------- EMPLOYEES --------------------

// Get all employees with user info
router.get('/employees', verifyToken, (req, res) => {
  const query = `SELECT e.*, u.email, u.fullname FROM employees e JOIN usercredentials u ON e.user_id = u.id`;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching employees' });
    res.json(results);
  });
});

// Add new employee
router.post('/employees', verifyToken, (req, res) => {
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
router.put('/employees/:id', verifyToken, (req, res) => {
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
router.delete('/employees/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM employees WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error deleting employee' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Employee not found' });
    res.json({ message: 'Employee deleted' });
  });
});

// Get users not linked to employees
router.get('/unlinked-users', verifyToken, (req, res) => {
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

// -------------------- ATTENDANCE --------------------

router.get('/attendance', verifyToken, (req, res) => {
  db.query('SELECT * FROM attendance ORDER BY date DESC', (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching attendance' });
    res.json(results);
  });
});

router.post('/attendance', verifyToken, (req, res) => {
  const {
    employee_id, date, check_in, check_out, status,
    check_in_location, check_out_location, worked_hours,
    is_late, remarks, leave_type
  } = req.body;

  if (!employee_id || !date) return res.status(400).json({ message: 'Employee ID and date required' });

  const sql = `
    INSERT INTO attendance
    (employee_id, date, check_in, check_out, status, check_in_location, check_out_location, worked_hours, is_late, remarks, leave_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.query(sql, [
    employee_id, date, check_in, check_out, status,
    check_in_location, check_out_location, worked_hours,
    is_late ? 1 : 0, remarks, leave_type
  ], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error inserting attendance' });
    res.status(201).json({ message: 'Attendance recorded', id: result.insertId });
  });
});

router.put('/attendance/:id', verifyToken, (req, res) => {
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
  ], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error updating attendance' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Attendance not found' });
    res.json({ message: 'Attendance updated' });
  });
});

router.delete('/attendance/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM attendance WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error deleting attendance' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Attendance not found' });
    res.json({ message: 'Attendance deleted' });
  });
});

// -------------------- LEAVES --------------------

router.get('/leaves', verifyToken, (req, res) => {
  db.query('SELECT * FROM leave_requests ORDER BY created_at DESC', (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching leaves' });
    res.json(results);
  });
});

router.put('/leaves/:id/status', verifyToken, (req, res) => {
  const { id } = req.params;
  let { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'Status is required' });
  }

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
      res.json({ message: 'Leave status updated' });
    }
  );
});


router.delete('/leaves/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM leave_requests WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error deleting leave request' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Leave request not found' });
    res.json({ message: 'Leave request deleted' });
  });
});


router.get('/attendance/today', verifyToken, (req, res) => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const sql = 'SELECT * FROM attendance WHERE date = ?';
  db.query(sql, [today], (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching today\'s attendance' });
    res.json(results);
  });
});


module.exports = router;
