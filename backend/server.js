const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { verifyToken, verifyAdmin } = require('./auth');

const authRoutes = require('./routes/authentification');
const userRoutes = require('./routes/users');
const attendanceRoutes = require('./routes/attendance');
const leavesRoutes = require('./routes/leaves');
const profileRoutes = require('./routes/profile');
const employeesRoutes = require('./routes/employees');

const app = express();
const PORT = process.env.PORT || 3000; // 3000 is now the safe fallback

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leavesRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/employees', employeesRoutes);

// Token validation route (for testing)
app.get('/api/validate-token', verifyToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// Global error handler (optional)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

