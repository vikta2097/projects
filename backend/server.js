const express = require('express');
const http = require('http'); // Required for socket.io
const cors = require('cors');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: 'http://localhost:3000', credentials: true } });

// ✅ ✅ Middleware FIRST — fix CORS issues
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Import routes after middleware
const { verifyToken, verifyAdmin } = require('./auth');
const authRoutes = require('./routes/authentification');
const userRoutes = require('./routes/users');
const attendanceRoutes = require('./routes/attendance');
const leavesRoutes = require('./routes/leaves');
const profileRoutes = require('./routes/profile');
const employeesRoutes = require('./routes/employees');
const payrollRoutes = require('./routes/payrollRoutes');

// Notification & Messaging Imports
const { router: notificationRoutes, initNotifications } = require('./routes/notifications');
const messaging = require('./routes/messaging');

// Initialize Real-Time Features
const connectedClients = {};
initNotifications(io, connectedClients);
messaging.setSocketIO(io, connectedClients);

// ✅ Mount routes after CORS & JSON middleware
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leavesRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messaging.router);
app.use('/api/payroll', payrollRoutes); // ✅ Can now be safely used

// Token validation route
app.get('/api/validate-token', verifyToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Socket.IO connection logic
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('identify', (userId) => {
    if (userId) {
      connectedClients[userId] = socket.id;
      console.log(`User ${userId} connected with socket ID ${socket.id}`);
    }
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of Object.entries(connectedClients)) {
      if (socketId === socket.id) {
        delete connectedClients[userId];
        console.log(`User ${userId} disconnected`);
        break;
      }
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});


console.log('payrollRoutes type:', typeof payrollRoutes);


// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
