import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

function Messaging() {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [socket, setSocket] = useState(null);

  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId'); // Ensure you store userId on login

  useEffect(() => {
    // Connect to Socket.io server
    const newSocket = io('http://localhost:3300'); // Change port if needed
    setSocket(newSocket);

    // Identify the user to the server
    if (userId) {
      newSocket.emit('identify', userId);
    }

    // Listen for incoming messages
    newSocket.on('receive-message', (message) => {
      // Check if the incoming message belongs to the selected conversation
      if (selectedConv && message.conversationId === selectedConv.conversationId) {
        setMessages((prev) => [...prev, message]);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [userId, selectedConv]);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/messages/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      } else {
        console.error('Failed to load conversations');
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchMessages = async (convId) => {
    try {
      const res = await fetch(`/api/messages/conversations/${convId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      } else {
        console.error('Failed to load messages');
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const selectConversation = (conv) => {
    setSelectedConv(conv);
    fetchMessages(conv.conversationId);
  };

  const sendMessage = async () => {
    if (!newMsg.trim()) return;

    try {
      const res = await fetch(
        `/api/messages/conversations/${selectedConv.conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: newMsg }),
        }
      );

      if (res.ok) {
        // Immediately add the sent message locally
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(), // Temporary ID
            sender_id: userId,
            sender_name: 'You',
            content: newMsg,
            created_at: new Date().toISOString(),
          },
        ]);
        setNewMsg('');
      } else {
        alert('Failed to send message');
      }
    } catch (error) {
      alert('Error sending message');
      console.error(error);
    }
  };

  return (
    <div style={{ display: 'flex', height: '500px', border: '1px solid #ccc' }}>
      <div
        style={{
          width: '250px',
          borderRight: '1px solid #ccc',
          overflowY: 'auto',
        }}
      >
        <h3>Conversations</h3>
        {conversations.length === 0 && <p>No conversations yet.</p>}
        {conversations.map((conv) => (
          <div
            key={conv.conversationId}
            onClick={() => selectConversation(conv)}
            style={{
              padding: '10px',
              cursor: 'pointer',
              backgroundColor:
                selectedConv?.conversationId === conv.conversationId ? '#eee' : '#fff',
            }}
          >
            <strong>{conv.participants}</strong>
            <div style={{ fontSize: '12px', color: '#666' }}>{conv.lastMessage || 'No messages yet'}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3>Chat</h3>
        <div
          style={{
            flex: 1,
            padding: '10px',
            overflowY: 'auto',
            borderBottom: '1px solid #ccc',
          }}
        >
          {selectedConv ? (
            messages.length === 0 ? (
              <p>No messages in this conversation yet.</p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} style={{ marginBottom: '10px' }}>
                  <strong>{msg.sender_name}</strong>{' '}
                  <small>{new Date(msg.created_at).toLocaleString()}</small>
                  <p>{msg.content}</p>
                </div>
              ))
            )
          ) : (
            <p>Select a conversation to start chatting</p>
          )}
        </div>
        {selectedConv && (
          <div style={{ display: 'flex' }}>
            <input
              type="text"
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              placeholder="Type your message..."
              style={{ flex: 1, padding: '10px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendMessage();
              }}
            />
            <button onClick={sendMessage} style={{ padding: '10px' }}>
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Messaging;
