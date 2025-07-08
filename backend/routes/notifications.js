const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../auth');

let io, connectedClients;

function initNotifications(socketIo, clientMap) {
  io = socketIo;
  connectedClients = clientMap;
}

// Enhanced notification types and priorities
const NOTIFICATION_TYPES = {
  EMERGENCY: 'emergency',
  DISPATCH: 'dispatch',
  SYSTEM: 'system',
  MEDICAL: 'medical',
  ALERT: 'alert',
  INFO: 'info',
  LEAVE: 'leave',           // add this
  ATTENDANCE: 'attendance', // add this
};


const PRIORITY_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  CRITICAL: 'critical'
};

// Get all notifications for the logged-in user with pagination
router.get('/', verifyToken, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const userId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const type = req.query.type;
  const unreadOnly = req.query.unread === 'true';
  const fetchAll = req.query.all === 'true' && isAdmin;

  let query = 'SELECT * FROM notifications WHERE ';
  let params = [];

  if (fetchAll) {
    query += '1=1';
  } else {
    query += 'user_id = ?';
    params.push(userId);
  }

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  if (unreadOnly) {
    query += ' AND is_read = 0';
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching notifications', error: err.message });

    let countQuery = fetchAll
      ? 'SELECT COUNT(*) as total FROM notifications WHERE 1=1'
      : 'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?';
    let countParams = fetchAll ? [] : [userId];

    if (type) {
      countQuery += ' AND type = ?';
      countParams.push(type);
    }

    if (unreadOnly) {
      countQuery += ' AND is_read = 0';
    }

    db.query(countQuery, countParams, (err, countResult) => {
      if (err) return res.status(500).json({ message: 'Error fetching count', error: err.message });

      res.json({
        notifications: results,
        pagination: {
          page,
          limit,
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limit),
        },
      });
    });
  });
});

// Get unread count
router.get('/unread-count', verifyToken, (req, res) => {
  const userId = req.user.id;
  
  db.query('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', [userId], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error fetching unread count', error: err.message });
    res.json({ unreadCount: result[0].count });
  });
});

// Mark a notification as read
router.put('/:id/read', verifyToken, (req, res) => {
  const { id } = req.params;
  const isAdmin = req.user.role === 'admin';
  const userId = req.user.id;

  let query = 'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ?';
  let params = [id];

  if (!isAdmin) {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json({ message: 'Error updating notification', error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Notification not found or access denied' });
    res.json({ message: 'Notification marked as read' });
  });
});  

// Mark all notifications as read
router.put('/read-all', verifyToken, (req, res) => {
  const userId = req.user.id;

  db.query('UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0', [userId], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error updating notifications', error: err.message });
    res.json({ message: 'All notifications marked as read', updatedCount: result.affectedRows });
  });
});

// Delete a notification
router.delete('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const isAdmin = req.user.role === 'admin';
  const userId = req.user.id;

  let query = 'DELETE FROM notifications WHERE id = ?';
  let params = [id];

  if (!isAdmin) {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json({ message: 'Error deleting notification', error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Notification not found or access denied' });
    res.json({ message: 'Notification deleted' });
  });
});

// Enhanced send notification with more options
router.post('/send', verifyToken, (req, res) => {
  const { 
    userId, 
    message, 
    title = 'New Notification',
    type = NOTIFICATION_TYPES.INFO,
    priority = PRIORITY_LEVELS.MEDIUM,
    metadata = null,
    expiresAt = null
  } = req.body;

  // Validate inputs
  if (!userId || !message) {
    return res.status(400).json({ message: 'userId and message are required' });
  }

  if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
    return res.status(400).json({ message: 'Invalid notification type' });
  }

  if (!Object.values(PRIORITY_LEVELS).includes(priority)) {
    return res.status(400).json({ message: 'Invalid priority level' });
  }

  const notificationData = {
    user_id: userId,
    title,
    message,
    type,
    priority,
    metadata: metadata ? JSON.stringify(metadata) : null,
    expires_at: expiresAt,
    created_at: new Date()
  };

  db.query(
    'INSERT INTO notifications (user_id, title, message, type, priority, metadata, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, title, message, type, priority, notificationData.metadata, expiresAt],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Error saving notification', error: err.message });

      const notification = {
        id: result.insertId,
        ...notificationData,
        is_read: 0,
        read_at: null
      };

      // Emit to user if connected
      const socketId = connectedClients[userId];
      if (socketId) {
        io.to(socketId).emit('new-notification', notification);
      }

      // Emit to all connected clients if it's a system-wide notification
      if (type === NOTIFICATION_TYPES.SYSTEM || priority === PRIORITY_LEVELS.CRITICAL) {
        io.emit('system-notification', notification);
      }

      res.json({ 
        message: 'Notification sent', 
        notificationId: result.insertId,
        notification
      });
    }
  );
});

// Broadcast notification to multiple users
router.post('/broadcast', verifyToken, (req, res) => {
  const { 
    userIds, 
    message, 
    title = 'Broadcast Notification',
    type = NOTIFICATION_TYPES.INFO,
    priority = PRIORITY_LEVELS.MEDIUM,
    metadata = null
  } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ message: 'userIds array is required' });
  }

  if (!message) {
    return res.status(400).json({ message: 'message is required' });
  }

  const notifications = userIds.map(userId => [
    userId, title, message, type, priority, 
    metadata ? JSON.stringify(metadata) : null
  ]);

  db.query(
    'INSERT INTO notifications (user_id, title, message, type, priority, metadata) VALUES ?',
    [notifications],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Error broadcasting notifications', error: err.message });

      // Emit to connected users
      userIds.forEach((userId, index) => {
        const socketId = connectedClients[userId];
        if (socketId) {
          const notification = {
            id: result.insertId + index,
            user_id: userId,
            title,
            message,
            type,
            priority,
            metadata,
            is_read: 0,
            created_at: new Date()
          };
          io.to(socketId).emit('new-notification', notification);
        }
      });

      res.json({ 
        message: 'Notifications broadcasted', 
        notificationCount: userIds.length,
        firstNotificationId: result.insertId
      });
    }
  );
});

// Get notification statistics
router.get('/stats', verifyToken, (req, res) => {
  const userId = req.user.id;
  
  const queries = [
    'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?',
    'SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = 0',
    'SELECT type, COUNT(*) as count FROM notifications WHERE user_id = ? GROUP BY type',
    'SELECT priority, COUNT(*) as count FROM notifications WHERE user_id = ? GROUP BY priority'
  ];

  Promise.all(queries.map(query => new Promise((resolve, reject) => {
    console.log("[/stats] called by user id:", req.user?.id);

    db.query(query, [userId], (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  }))).then(results => {
    res.json({
      total: results[0][0].total,
      unread: results[1][0].unread,
      byType: results[2],
      byPriority: results[3]
    });
  }).catch(err => {
    res.status(500).json({ message: 'Error fetching statistics', error: err.message });
  });
});

// Clean up expired notifications
router.delete('/cleanup/expired', verifyToken, (req, res) => {
  db.query('DELETE FROM notifications WHERE expires_at IS NOT NULL AND expires_at < NOW()', (err, result) => {
    if (err) return res.status(500).json({ message: 'Error cleaning up notifications', error: err.message });
    res.json({ message: 'Expired notifications cleaned up', deletedCount: result.affectedRows });
  });
});

router.use((req, res, next) => {
  console.log(`[Notifications] ${req.method} ${req.originalUrl}`);
  next();
});

function sendNotificationDirect({ userId, title = 'New Notification', message, type, priority, metadata = null, expiresAt = null }) {
  return new Promise((resolve, reject) => {
    if (!userId || !message) {
      return reject(new Error('userId and message are required'));
    }
    if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
      return reject(new Error('Invalid notification type'));
    }
    if (!Object.values(PRIORITY_LEVELS).includes(priority)) {
      return reject(new Error('Invalid priority level'));
    }

    const notificationData = {
      user_id: userId,
      title,
      message,
      type,
      priority,
      metadata: metadata ? JSON.stringify(metadata) : null,
      expires_at: expiresAt,
      created_at: new Date(),
      is_read: 0,
      read_at: null
    };

    db.query(
      'INSERT INTO notifications (user_id, title, message, type, priority, metadata, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, title, message, type, priority, notificationData.metadata, expiresAt, notificationData.created_at],
      (err, result) => {
        if (err) return reject(err);

        notificationData.id = result.insertId;

        // Emit socket notification if user is connected
        const socketId = connectedClients[userId];
        if (socketId) {
          io.to(socketId).emit('new-notification', notificationData);
        }

        // Emit to all if system or critical
        if (type === NOTIFICATION_TYPES.SYSTEM || priority === PRIORITY_LEVELS.CRITICAL) {
          io.emit('system-notification', notificationData);
        }

        resolve(notificationData);
      }
    );
  });
}

module.exports = {
  router,
  initNotifications,
  NOTIFICATION_TYPES,
  PRIORITY_LEVELS,
  sendNotificationDirect, // export this
};