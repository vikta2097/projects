const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'photos');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    // Make sure we have a unique filename with user ID and timestamp
    cb(null, `user-${req.user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`);
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// GET logged in user's profile
router.get('/', verifyToken, (req, res) => {
  const userId = req.user.id;
  
  const sql = `
    SELECT u.fullname, u.email, u.role, e.department, e.job_title, e.phone, e.address, e.status, e.date_of_hire, e.profile_photo
    FROM usercredentials u
    LEFT JOIN employees e ON u.id = e.user_id
    WHERE u.id = ?
  `;
  
  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    res.json(results[0]);
  });
});

// Update logged in user's phone and address only
router.put('/', verifyToken, (req, res) => {
  const userId = req.user.id;
  const { phone, address } = req.body;
  
  if (!phone || !address) {
    return res.status(400).json({ message: 'Phone and address are required' });
  }
  
  const sql = `
    UPDATE employees
    SET phone = ?, address = ?
    WHERE user_id = ?
  `;
  
  db.query(sql, [phone, address, userId], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }
    
    res.json({ phone, address });
  });
});

// Upload profile photo
router.post('/photo', verifyToken, upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No photo uploaded' });
  }
  
  const photoPath = `/uploads/photos/${req.file.filename}`;
  const userId = req.user.id;
  
  // First, get the current photo to delete it later
  const getCurrentPhotoSql = 'SELECT profile_photo FROM employees WHERE user_id = ?';
  
  db.query(getCurrentPhotoSql, [userId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    
    const oldPhotoPath = results[0]?.profile_photo;
    
    // Update with new photo
    const updateSql = 'UPDATE employees SET profile_photo = ? WHERE user_id = ?';
    
    db.query(updateSql, [photoPath, userId], (err, result) => {
      if (err) {
        console.error('Database error:', err);
        // Delete the uploaded file since database update failed
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting file:', unlinkErr);
        });
        return res.status(500).json({ message: 'Failed to save photo' });
      }
      
      if (result.affectedRows === 0) {
        // Delete the uploaded file since no rows were updated
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting file:', unlinkErr);
        });
        return res.status(404).json({ message: 'Employee profile not found' });
      }
      
      // Delete old photo file if it exists
      if (oldPhotoPath) {
        const oldFilePath = path.join(__dirname, '..', oldPhotoPath);
        fs.unlink(oldFilePath, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting old file:', unlinkErr);
        });
      }
      
      res.json({ 
        message: 'Photo uploaded successfully', 
        photo: photoPath 
      });
    });
  });
});

module.exports = router;