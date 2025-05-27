const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
const saltRounds = 10;

// Middleware
app.use(cors());
app.use(express.json());

// ✅ MySQL connection using environment variables
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'simplelogin',
});

db.connect((err) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Connected to MySQL database.');
  }
});

// ✅ Register route
app.post('/api/register', (req, res) => {
  const { fullname, email, password } = req.body;

  if (!fullname || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (email.length > 25 || password.length > 16 || fullname.length > 30) {
    return res.status(400).json({ message: 'Input exceeds allowed length' });
  }

  bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
    if (err) return res.status(500).json({ message: 'Error hashing password', error: err.message });

    const sql = 'INSERT INTO usercredentials (email, password, fullname) VALUES (?, ?, ?)';
    db.query(sql, [email, hashedPassword, fullname], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ message: 'Email already exists' });
        }
        return res.status(500).json({ message: 'Error registering user', error: err.message });
      }
      res.status(201).json({ message: 'User registered successfully' });
    });
  });
});

// ✅ Login route
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  const sql = 'SELECT * FROM usercredentials WHERE email = ?';
  db.query(sql, [email], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    if (results.length === 0) return res.status(401).json({ message: 'Invalid email or password' });

    const user = results[0];

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) return res.status(500).json({ message: 'Error verifying password', error: err.message });
      if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

      delete user.password;
      res.status(200).json({ message: 'Login successful', user });
    });
  });
});

// ✅ Forgot Password (sends email with hosted URL)
app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: 'Email is required' });

  const token = crypto.randomBytes(20).toString('hex');
  const expiry = new Date(Date.now() + 3600000); // 1 hour

  const sql = 'UPDATE usercredentials SET resetToken = ?, resetTokenExpiry = ? WHERE email = ?';
  db.query(sql, [token, expiry, email], (err, result) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Email not found' });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      text: `Click the following link to reset your password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.`,
    };

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) return res.status(500).json({ message: 'Failed to send email', error: error.message });
      res.status(200).json({ message: 'Password reset email sent' });
    });
  });
});

// ✅ Reset Password route
app.post('/api/reset-password', (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password are required' });
  }

  bcrypt.hash(newPassword, saltRounds, (err, hashedPassword) => {
    if (err) return res.status(500).json({ message: 'Error hashing new password', error: err.message });

    const sql = `
      UPDATE usercredentials
      SET password = ?, resetToken = NULL, resetTokenExpiry = NULL
      WHERE resetToken = ? AND resetTokenExpiry > NOW()
    `;
    db.query(sql, [hashedPassword, token], (err, result) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err.message });
      if (result.affectedRows === 0) return res.status(400).json({ message: 'Invalid or expired token' });

      res.status(200).json({ message: 'Password reset successful' });
    });
  });
});

// Test route
app.get('/', (req, res) => {
  res.send('✅ Backend server is running!');
});

// Start server
const PORT = process.env.PORT || 5100;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
