const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const { verifyToken } = require('../auth');

const { sendNotificationDirect, NOTIFICATION_TYPES, PRIORITY_LEVELS } = require('./notifications');

let ioInstance;
let connectedClients = {};

// Initialize Socket.IO instance and connected clients map
function setSocketIO(io, clientMap) {
  ioInstance = io;
  connectedClients = clientMap;
}

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename(req, file, cb) {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Create or get existing conversation between two users
router.post('/conversations', verifyToken, (req, res) => {
  const userId = req.user.id;
  const { otherUserId } = req.body;

  if (!otherUserId) return res.status(400).json({ message: 'Other user ID is required' });

  const findConversationQuery = `
    SELECT c.id FROM conversations c
    JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = ?
    JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = ?
    LIMIT 1
  `;

  db.query(findConversationQuery, [userId, otherUserId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    if (results.length > 0) {
      return res.json({ conversationId: results[0].id });
    }

    // Create new conversation and participants
    db.query('INSERT INTO conversations () VALUES ()', (err, result) => {
      if (err) return res.status(500).json({ message: 'Failed to create conversation' });

      const conversationId = result.insertId;
      db.query(
        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)',
        [conversationId, userId, conversationId, otherUserId],
        (err) => {
          if (err) return res.status(500).json({ message: 'Failed to add participants' });
          res.json({ conversationId });
        }
      );
    });
  });
});

// Get all conversations for logged-in user
router.get('/conversations', verifyToken, (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT c.id AS conversationId, 
      GROUP_CONCAT(u.fullname SEPARATOR ', ') AS participants,
      m.content AS lastMessage,
      m.created_at AS lastMessageTime
    FROM conversations c
    JOIN conversation_participants cp ON c.id = cp.conversation_id
    JOIN usercredentials u ON cp.user_id = u.id
    LEFT JOIN messages m ON m.conversation_id = c.id
      AND m.created_at = (SELECT MAX(created_at) FROM messages WHERE conversation_id = c.id)
    WHERE c.id IN (
      SELECT conversation_id FROM conversation_participants WHERE user_id = ?
    )
    GROUP BY c.id, m.content, m.created_at
    ORDER BY lastMessageTime DESC
  `;

  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch conversations' });
    res.json(results);
  });
});

// Get messages in a specific conversation (must be participant)
router.get('/conversations/:id/messages', verifyToken, (req, res) => {
  const conversationId = req.params.id;
  const userId = req.user.id;

  db.query(
    'SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
    [conversationId, userId],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (results.length === 0) return res.status(403).json({ message: 'Access denied' });

      const messagesQuery = `
        SELECT m.id, m.sender_id, u.fullname AS sender_name, m.content, 
               m.file_path, m.file_name, m.file_type, m.created_at 
        FROM messages m 
        JOIN usercredentials u ON m.sender_id = u.id 
        WHERE m.conversation_id = ? 
        ORDER BY m.created_at ASC
      `;

      db.query(messagesQuery, [conversationId], (err, messages) => {
        if (err) return res.status(500).json({ message: 'Failed to fetch messages' });
        res.json(messages);
      });
    }
  );
});

// Send message with optional file upload and notify participants
router.post('/conversations/:id/messages', verifyToken, upload.single('file'), (req, res) => {
  const conversationId = req.params.id;
  const userId = req.user.id;
  const { content } = req.body;
  const file = req.file;

  db.query(
    'SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
    [conversationId, userId],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (results.length === 0) return res.status(403).json({ message: 'Access denied' });

      const filePath = file ? `/uploads/${file.filename}` : null;
      const fileName = file ? file.originalname : null;
      const fileType = file ? file.mimetype : null;

      const insertMessageQuery = `
        INSERT INTO messages 
        (conversation_id, sender_id, content, file_path, file_name, file_type) 
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      db.query(
        insertMessageQuery,
        [conversationId, userId, content || '', filePath, fileName, fileType],
        async (err, result) => {
          if (err) return res.status(500).json({ message: 'Failed to send message' });

          const messageData = {
            id: result.insertId,
            conversationId,
            senderId: userId,
            content: content || '',
            file_path: filePath,
            file_name: fileName,
            file_type: fileType,
            created_at: new Date(),
          };

          // Emit message only to other participants, not sender
          db.query(
            'SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?',
            [conversationId, userId],
            async (err, participants) => {
              if (!err && ioInstance && participants.length) {
                // Send socket messages
                participants.forEach((p) => {
                  const socketId = connectedClients[p.user_id];
                  if (socketId) {
                    ioInstance.to(socketId).emit('receive-message', messageData);
                  }
                });

                // Send notification to other participants
                for (const p of participants) {
                  try {
                    await sendNotificationDirect({
                      userId: p.user_id,
                      title: 'New Message Received',
                      message: `You have a new message from user ID ${userId}`,
                      type: NOTIFICATION_TYPES.INFO,
                      priority: PRIORITY_LEVELS.MEDIUM,
                      metadata: {
                        conversationId,
                        senderId: userId,
                        messageId: messageData.id,
                      },
                      expiresAt: null,
                    });
                  } catch (notifyErr) {
                    console.error('Failed to send notification', notifyErr);
                  }
                }
              }
            }
          );

          res.json({ message: 'Message sent', ...messageData });
        }
      );
    }
  );
});

// Get users who are not yet in conversation with current user (to start new chat)
router.get('/available-users', verifyToken, (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT id, fullname FROM usercredentials
    WHERE id != ? AND id NOT IN (
      SELECT user_id FROM conversation_participants
      WHERE conversation_id IN (
        SELECT conversation_id FROM conversation_participants WHERE user_id = ?
      )
    )
  `;

  db.query(query, [userId, userId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(results);
  });
});

module.exports = { router, setSocketIO };
