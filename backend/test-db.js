// test-bcrypt.js
const bcrypt = require('bcrypt');
const db = require('./db');
require('dotenv').config();

const emailToTest = 'thigamwangi2027@gmail.com';  // Change this to test a specific user email
const passwordToTest = '12345678';      // The plaintext password you want to verify

db.query('SELECT password_hash FROM usercredentials WHERE email = ?', [emailToTest], async (err, results) => {
  if (err) {
    console.error('Database query error:', err);
    process.exit(1);
  }

  if (results.length === 0) {
    console.log('User not found.');
    process.exit(0);
  }

  const hashedPassword = results[0].password_hash;

  const match = await bcrypt.compare(passwordToTest, hashedPassword);
  if (match) {
    console.log('Password is correct!');
  } else {
    console.log('Password is incorrect!');
  }

  db.end();  // Close DB connection after test
});
