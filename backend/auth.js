// backend/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  console.log("Auth Header:", authHeader); // 🔍 Log this

  const token = authHeader && authHeader.split(' ')[1];
  console.log("Extracted token:", token); // 🔍 Log this

  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};


module.exports = verifyToken;
