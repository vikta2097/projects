const express = require('express');
const http = require('http'); // Required for socket.io
const cors = require('cors');
const socketIo = require('socket.io');
require('dotenv').config();

const { verifyToken, verifyAdmin } = require('./auth');

// Routes
const authRoutes = require('./routes/authentification');
const userRoutes = require('./routes/users');
const attendanceRoutes = require('./routes/attendance');
const leavesRoutes = require('./routes/leaves');
const profileRoutes = require('./routes/profile');
const employeesRoutes = require('./routes/employees');

// Notification & Messaging Imports
const { router: notificationRoutes, initNotifications } = require('./routes/notifications');
const messaging = require('./routes/messaging'); // Import entire messaging module

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const connectedClients = {};

// Initialize Real-Time Features
initNotifications(io, connectedClients);
messaging.setSocketIO(io);  // Use the correct function to initialize socket.io in messaging

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
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messaging.router);  // Use messaging router here

// Token validation route (for testing)
app.get('/api/validate-token', verifyToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Socket Connection
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Client should send their user ID immediately after connecting
  socket.on('identify', (userId) => {
    connectedClients[userId] = socket.id;
    console.log(`User ${userId} connected with socket ID ${socket.id}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Remove the user from connectedClients
    for (let userId in connectedClients) {
      if (connectedClients[userId] === socket.id) {
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

// Global error handler (optional)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
