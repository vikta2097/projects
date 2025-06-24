const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createConnection({
  host: process.env.DB_HOST,      // e.g. localhost
  user: process.env.DB_USER,      // e.g. root
  password: process.env.DB_PASSWORD || process.env.DB_PASS,  // fallback to either env variable
  database: process.env.DB_NAME,  // e.g. admin
  port: process.env.DB_PORT || 3306  // default port if not set
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('MySQL connection error!', err);
    throw err;
  }
  console.log('✅ Connected to MySQL database!');
});

// Export the db instance for reuse
module.exports = db;
