const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../auth');

// Pass the io instance from server.js
let ioInstance;

function setSocketIO(io) {
  ioInstance = io;
}

// Create new conversation or get existing conversation between two users
router.post('/conversations', verifyToken, (req, res) => {
  const userId = req.user.id;
  const { otherUserId } = req.body;

  if (!otherUserId) return res.status(400).json({ message: 'Other user ID is required' });

  const query = `
    SELECT c.id FROM conversations c
    JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = ?
    JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = ?
    LIMIT 1`;

  db.query(query, [userId, otherUserId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    if (results.length > 0) {
      return res.json({ conversationId: results[0].id });
    }

    // Create new conversation
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

// Get conversations for logged-in user
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

// Get messages for a conversation
router.get('/conversations/:id/messages', verifyToken, (req, res) => {
  const conversationId = req.params.id;
  const userId = req.user.id;

  db.query(
    'SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
    [conversationId, userId],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (results.length === 0) return res.status(403).json({ message: 'Access denied' });

      db.query(
        'SELECT m.id, m.sender_id, u.fullname AS sender_name, m.content, m.is_read, m.created_at FROM messages m JOIN usercredentials u ON m.sender_id = u.id WHERE m.conversation_id = ? ORDER BY m.created_at ASC',
        [conversationId],
        (err, messages) => {
          if (err) return res.status(500).json({ message: 'Failed to fetch messages' });
          res.json(messages);
        }
      );
    }
  );
});

// Send a message in a conversation
router.post('/conversations/:id/messages', verifyToken, (req, res) => {
  const conversationId = req.params.id;
  const userId = req.user.id;
  const { content } = req.body;

  if (!content) return res.status(400).json({ message: 'Message content required' });

  db.query(
    'SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
    [conversationId, userId],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (results.length === 0) return res.status(403).json({ message: 'Access denied' });

      db.query(
        'INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)',
        [conversationId, userId, content],
        (err, result) => {
          if (err) return res.status(500).json({ message: 'Failed to send message' });

          // Real-time: Emit the new message to other participants
          if (ioInstance) {
            ioInstance.emit('receive-message', {
              conversationId,
              senderId: userId,
              content,
              created_at: new Date(),
            });
          }

          res.json({ message: 'Message sent' });
        }
      );
    }
  );
});

module.exports = { router, setSocketIO };
