// minimal-server.js - Simplified server to test if Express is working
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Basic test route
app.get('/', (req, res) => {
  res.send('Backend server is running!');
});

// Test route that doesn't require database
app.post('/api/test', (req, res) => {
  const data = req.body;
  res.status(200).json({
    message: 'Test successful',
    receivedData: data
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Test server is running on http://localhost:${PORT}`);
});