const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmail() {
  const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});


  try {
    let info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'Test email',
      text: 'This is a test email from Node.js',
    });
    console.log('Email sent:', info.response);
  } catch (err) {
    console.error('Email send failed:', err);
  }
}

testEmail();
