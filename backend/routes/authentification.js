const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const db = require('../db');

require('dotenv').config();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
  return /^(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{6,}$/.test(password);
}

// REGISTER
router.post('/register', async (req, res) => {
  const { email, password, fullname, role } = req.body;

  if (!email || !password || !fullname) {
    return res.status(400).json({ message: 'Email, password, and fullname are required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ 
      message: 'Password must be at least 6 chars with a number, a special character, and a lowercase letter'
    });
  }

  const userRole = role === 'admin' ? 'admin' : 'user';

  try {
    db.query('SELECT id FROM usercredentials WHERE email = ?', [email], async (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (results.length > 0) return res.status(409).json({ message: 'Email already registered' });

      const hashed = await bcrypt.hash(password, 10);
      db.query(
        'INSERT INTO usercredentials (email, password_hash, fullname, role) VALUES (?, ?, ?, ?)', 
        [email, hashed, fullname, userRole],
        (err) => {
          if (err) return res.status(500).json({ message: 'Registration failed' });
          res.json({ message: 'User registered successfully' });
        }
      );
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// LOGIN
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  db.query('SELECT * FROM usercredentials WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (results.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn:'1h' });
    res.json({ token });
  });
});

// Forgot password (send reset link)
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  db.query('SELECT id FROM usercredentials WHERE email = ?', [email], (err, results) => {
    if (err) {
      console.error('DB error during password reset!', err);
      return res.status(500).json({ message: 'Database error' });
    }
    if (results.length === 0) return res.status(404).json({ message: 'Email not found' });

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
        console.error('Email sending error!', err);
        return res.status(500).json({ message: 'Failed to send email' });
      }
      res.json({ message: 'Reset link sent to email' });
    });
  });
});

// Reset password (via token)
router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || !isValidPassword(password)) {
    return res.status(400).json({ 
      message: 'Password must be at least 6 characters and include a lowercase letter, a number, and a special character' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query('UPDATE usercredentials SET password_hash = ? WHERE email = ?', [hashedPassword, decoded.email], (err) => {
      if (err) {
        console.error('DB error during password reset!', err);
        return res.status(500).json({ message: 'Password reset failed' });
      }
      res.json({ message: 'Password reset successful' });
    });
  } catch (err) {
    console.error('Invalid or expired token!', err);
    res.status(400).json({ message: 'Invalid or expired token' });
  }
});

module.exports = router;
