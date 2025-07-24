const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../auth');

let io, connectedClients;

function initNotifications(socketIo, clientMap) {
  io = socketIo;
  connectedClients = clientMap;
}

// Notification types and priorities
const NOTIFICATION_TYPES = {
  EMERGENCY: 'emergency',
  DISPATCH: 'dispatch',
  SYSTEM: 'system',
  MEDICAL: 'medical',
  ALERT: 'alert',
  INFO: 'info',
  LEAVE: 'leave',
  ATTENDANCE: 'attendance',
};

const PRIORITY_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

// Middleware for logging
router.use((req, res, next) => {
  console.log(`[Notifications] ${req.method} ${req.originalUrl}`);
  next();
});

// GET / - fetch notifications with filtering, pagination, and admin fetch all option
router.get('/', verifyToken, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const type = req.query.type;
  const unreadOnly = req.query.unread === 'true';
  const fetchAll = req.query.all === 'true' && isAdmin;

  let baseQuery = `
    SELECT n.*, u.fullname AS sender_name 
    FROM notifications n
    JOIN usercredentials u ON n.user_id = u.id
    WHERE
  `;
  const params = [];

  if (fetchAll) {
    baseQuery += '1=1';
  } else {
    baseQuery += 'n.user_id = ?';
    params.push(userId);
  }

  if (type) {
    baseQuery += ' AND n.type = ?';
    params.push(type);
  }

  if (unreadOnly) {
    baseQuery += ' AND n.is_read = 0';
  }

  const finalQuery = baseQuery + ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  db.query(finalQuery, params, (err, notifications) => {
    if (err) return res.status(500).json({ message: 'Error fetching notifications', error: err.message });

    // Count total for pagination
    let countQuery = fetchAll
      ? 'SELECT COUNT(*) AS total FROM notifications WHERE 1=1'
      : 'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?';
    const countParams = fetchAll ? [] : [userId];

    if (type) {
      countQuery += ' AND type = ?';
      countParams.push(type);
    }
    if (unreadOnly) {
      countQuery += ' AND is_read = 0';
    }

    db.query(countQuery, countParams, (err, countResult) => {
      if (err) return res.status(500).json({ message: 'Error fetching notification count', error: err.message });

      res.json({
        notifications,
        pagination: {
          page,
          limit,
          total: countResult[0]?.total || 0,
          pages: Math.ceil((countResult[0]?.total || 0) / limit),
        },
      });
    });
  });
});

// GET /unread-count - count unread notifications for the logged-in user
router.get('/unread-count', verifyToken, (req, res) => {
  const userId = req.user.id;

  db.query('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0', [userId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching unread count', error: err.message });
    res.json({ unreadCount: results[0].count });
  });
});

// PUT /:id/read - mark a notification as read
router.put('/:id/read', verifyToken, (req, res) => {
  const { id } = req.params;
  const isAdmin = req.user.role === 'admin';
  const userId = req.user.id;

  let query = 'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ?';
  const params = [id];

  if (!isAdmin) {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json({ message: 'Error marking notification as read', error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Notification not found or access denied' });
    res.json({ message: 'Notification marked as read' });
  });
});

// PUT /read-all - mark all notifications as read for user
router.put('/read-all', verifyToken, (req, res) => {
  const userId = req.user.id;

  db.query('UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0', [userId], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error marking all notifications as read', error: err.message });
    res.json({ message: 'All notifications marked as read', updatedCount: result.affectedRows });
  });
});

// DELETE /:id - delete notification (admins can delete any, users only their own)
router.delete('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const isAdmin = req.user.role === 'admin';
  const userId = req.user.id;

  let query = 'DELETE FROM notifications WHERE id = ?';
  const params = [id];

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

// POST /send - send a notification to a single user
router.post('/send', verifyToken, (req, res) => {
  const {
    userId,
    message,
    title = 'New Notification',
    type = NOTIFICATION_TYPES.INFO,
    priority = PRIORITY_LEVELS.MEDIUM,
    metadata = null,
    expiresAt = null,
  } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ message: 'userId and message are required' });
  }
  if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
    return res.status(400).json({ message: 'Invalid notification type' });
  }
  if (!Object.values(PRIORITY_LEVELS).includes(priority)) {
    return res.status(400).json({ message: 'Invalid priority level' });
  }

  const createdAt = new Date();

  db.query(
    'INSERT INTO notifications (user_id, title, message, type, priority, metadata, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [userId, title, message, type, priority, metadata ? JSON.stringify(metadata) : null, expiresAt, createdAt],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Error saving notification', error: err.message });

      const notification = {
        id: result.insertId,
        user_id: userId,
        title,
        message,
        type,
        priority,
        metadata,
        expires_at: expiresAt,
        created_at: createdAt,
        is_read: 0,
        read_at: null,
      };

      // Emit to user socket if connected
      const socketId = connectedClients[userId];
      if (socketId) {
        io.to(socketId).emit('new-notification', notification);
      }

      // Emit system-wide if type/system or critical priority
      if (type === NOTIFICATION_TYPES.SYSTEM || priority === PRIORITY_LEVELS.CRITICAL) {
        io.emit('system-notification', notification);
      }

      res.json({ message: 'Notification sent', notificationId: notification.id, notification });
    }
  );
});

// POST /broadcast - broadcast a notification to multiple users
router.post('/broadcast', verifyToken, (req, res) => {
  const {
    userIds,
    message,
    title = 'Broadcast Notification',
    type = NOTIFICATION_TYPES.INFO,
    priority = PRIORITY_LEVELS.MEDIUM,
    metadata = null,
  } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ message: 'userIds array is required' });
  }
  if (!message) {
    return res.status(400).json({ message: 'message is required' });
  }
  if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
    return res.status(400).json({ message: 'Invalid notification type' });
  }
  if (!Object.values(PRIORITY_LEVELS).includes(priority)) {
    return res.status(400).json({ message: 'Invalid priority level' });
  }

  const notifications = userIds.map(userId => [
    userId,
    title,
    message,
    type,
    priority,
    metadata ? JSON.stringify(metadata) : null,
  ]);

  db.query(
    'INSERT INTO notifications (user_id, title, message, type, priority, metadata) VALUES ?',
    [notifications],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Error broadcasting notifications', error: err.message });

      // Emit socket notifications for each user if connected
      userIds.forEach((userId, idx) => {
        const socketId = connectedClients[userId];
        if (socketId) {
          const notification = {
            id: result.insertId + idx,
            user_id: userId,
            title,
            message,
            type,
            priority,
            metadata,
            is_read: 0,
            created_at: new Date(),
            read_at: null,
          };
          io.to(socketId).emit('new-notification', notification);
        }
      });

      res.json({
        message: 'Notifications broadcasted',
        notificationCount: userIds.length,
        firstNotificationId: result.insertId,
      });
    }
  );
});

// GET /stats - notification stats for user
router.get('/stats', verifyToken, (req, res) => {
  const userId = req.user.id;

  const queries = [
    'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?',
    'SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = 0',
    'SELECT type, COUNT(*) as count FROM notifications WHERE user_id = ? GROUP BY type',
    'SELECT priority, COUNT(*) as count FROM notifications WHERE user_id = ? GROUP BY priority',
  ];

  Promise.all(
    queries.map(
      query =>
        new Promise((resolve, reject) => {
          db.query(query, [userId], (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        })
    )
  )
    .then(results => {
      res.json({
        total: results[0][0]?.total || 0,
        unread: results[1][0]?.unread || 0,
        byType: results[2],
        byPriority: results[3],
      });
    })
    .catch(err => {
      res.status(500).json({ message: 'Error fetching statistics', error: err.message });
    });
});

// DELETE /cleanup/expired - delete expired notifications
router.delete('/cleanup/expired', verifyToken, (req, res) => {
  db.query('DELETE FROM notifications WHERE expires_at IS NOT NULL AND expires_at < NOW()', (err, result) => {
    if (err) return res.status(500).json({ message: 'Error cleaning up expired notifications', error: err.message });
    res.json({ message: 'Expired notifications cleaned up', deletedCount: result.affectedRows });
  });
});

// Direct send notification function for internal use
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

    const createdAt = new Date();

    db.query(
      'INSERT INTO notifications (user_id, title, message, type, priority, metadata, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, title, message, type, priority, metadata ? JSON.stringify(metadata) : null, expiresAt, createdAt],
      (err, result) => {
        if (err) return reject(err);

        const notificationData = {
          id: result.insertId,
          user_id: userId,
          title,
          message,
          type,
          priority,
          metadata,
          expires_at: expiresAt,
          created_at: createdAt,
          is_read: 0,
          read_at: null,
        };

        // Emit to user socket if connected
        const socketId = connectedClients[userId];
        if (socketId) {
          io.to(socketId).emit('new-notification', notificationData);
        }

        // Emit system-wide if type/system or critical priority
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
  sendNotificationDirect,
};
