// backend/server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const verifyToken = require('./auth'); // assuming you have this file
const userRoutes = require('./Users');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', userRoutes);

// Token validation route
app.get('/api/validate-token', verifyToken, (req, res) => {
  res.json({ valid: true });
});

console.log('Users routes mounted at /api');

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
