import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

import "../styles/Messaging.css";

function Messaging({ userId }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [socket, setSocket] = useState(null);
  const [file, setFile] = useState(null);
  const [showStartChatModal, setShowStartChatModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [searchUser, setSearchUser] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const fileInputRef = useRef();
  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3300/api";

  // Initialize socket once on userId change
  useEffect(() => {
    if (!userId) return;

    const socketURL = API_URL.replace("/api", "");
    const sock = io(socketURL, { autoConnect: true });

    sock.emit("identify", userId);
    setSocket(sock);

    return () => {
      sock.disconnect();
    };
  }, [userId]);

  // Listen for incoming messages when socket or selectedConv changes
  useEffect(() => {
    if (!socket) return;

    function onMessage(msg) {
      if (selectedConv && msg.conversationId === selectedConv.conversationId) {
        setMessages((prev) => [...prev, msg]);
      }
    }

    socket.on("receive-message", onMessage);

    return () => {
      socket.off("receive-message", onMessage);
    };
  }, [socket, selectedConv]);

  // Fetch conversations
  useEffect(() => {
    if (!userId) return;

    setLoadingConversations(true);
    fetch(`${API_URL}/messages/conversations`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch conversations");
        return res.json();
      })
      .then((data) => {
        setConversations(data);
        if (data.length > 0) {
          setSelectedConv(data[0]); // Auto-select first conversation
        } else {
          setSelectedConv(null);
          setMessages([]);
        }
      })
      .catch((err) => {
        console.error(err);
        setConversations([]);
        setSelectedConv(null);
        setMessages([]);
      })
      .finally(() => setLoadingConversations(false));
  }, [userId]);

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selectedConv) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    fetch(`${API_URL}/messages/conversations/${selectedConv.conversationId}/messages`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch messages");
        return res.json();
      })
      .then(setMessages)
      .catch((err) => {
        console.error(err);
        setMessages([]);
      })
      .finally(() => setLoadingMessages(false));
  }, [selectedConv]);

  // Fetch available users for new chat modal
  useEffect(() => {
    if (!showStartChatModal) return;

    setLoadingUsers(true);
    fetch(`${API_URL}/messages/available-users`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch available users");
        return res.json();
      })
      .then(setAvailableUsers)
      .catch((err) => {
        console.error(err);
        setAvailableUsers([]);
      })
      .finally(() => setLoadingUsers(false));
  }, [showStartChatModal]);

  // Scroll to bottom on messages update
  const messagesEndRef = useRef(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle sending message with optional file
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!selectedConv || (!messageInput.trim() && !file)) return;

    const formData = new FormData();
    formData.append("content", messageInput.trim());
    if (file) formData.append("file", file);

    fetch(`${API_URL}/messages/conversations/${selectedConv.conversationId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: formData,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to send message");
        return res.json();
      })
      .then((data) => {
        setMessages((prev) => [...prev, data]);
        setMessageInput("");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = null;
      })
      .catch(console.error);
  };

  // Start new conversation with selected user
  const handleStartConversation = (user) => {
    fetch(`${API_URL}/messages/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ otherUserId: user.id }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to start conversation");
        return res.json();
      })
      .then(({ conversationId }) => {
        // Refresh conversations to include new one
        return fetch(`${API_URL}/messages/conversations`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        })
          .then((res) => {
            if (!res.ok) throw new Error("Failed to refresh conversations");
            return res.json();
          })
          .then((convs) => {
            setConversations(convs);
            const newConv = convs.find((c) => c.conversationId === conversationId);
            setSelectedConv(newConv);
            setShowStartChatModal(false);
            setSearchUser("");
            setAvailableUsers([]);
          });
      })
      .catch(console.error);
  };

  // Filter available users by search term
  const filteredAvailableUsers = availableUsers.filter((u) =>
    u.fullname.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="messaging-container">
      <div className="conversations-panel">
        <h2>Conversations</h2>
        <button onClick={() => setShowStartChatModal(true)} className="start-chat-btn">
          Start New Chat
        </button>
        {loadingConversations && <p>Loading conversations...</p>}
        {!loadingConversations && conversations.length === 0 && <p>No conversations yet</p>}
        <ul className="conversations-list">
          {conversations.map((conv) => (
            <li
              key={conv.conversationId}
              className={selectedConv?.conversationId === conv.conversationId ? "selected" : ""}
              onClick={() => setSelectedConv(conv)}
            >
              <div>
                <strong>{conv.participants}</strong>
              </div>
              <div className="last-message">{conv.lastMessage || <em>(No messages)</em>}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="chat-panel">
        {selectedConv ? (
          <>
            <h3>Chat with {selectedConv.participants}</h3>
            {loadingMessages ? (
              <p>Loading messages...</p>
            ) : (
              <div className="messages-list">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message-item ${
                      msg.sender_id === userId ? "outgoing" : "incoming"
                    }`}
                  >
                    <div className="message-sender">{msg.sender_name}</div>
                    <div className="message-content">
                      {msg.content && <p>{msg.content}</p>}
                      {msg.file_path && msg.file_type?.startsWith("image/") && (
                        <img
                          src={`${API_URL}${msg.file_path}`}
                          alt={msg.file_name}
                          className="message-image"
                        />
                      )}
                      {msg.file_path && !msg.file_type?.startsWith("image/") && (
                        <a href={`${API_URL}${msg.file_path}`} download>
                          Download {msg.file_name}
                        </a>
                      )}
                    </div>
                    <div className="message-time">{new Date(msg.created_at).toLocaleString()}</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            <form className="message-form" onSubmit={handleSendMessage}>
              <input
                type="text"
                placeholder="Type a message"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                disabled={!selectedConv}
              />
              <input
                key={file ? file.name : "empty"}
                type="file"
                ref={fileInputRef}
                onChange={(e) => setFile(e.target.files[0])}
              />
              <button
                type="submit"
                disabled={!messageInput.trim() && !file}
                className="send-button"
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="no-chat-selected">Select a conversation to start chatting</div>
        )}
      </div>

      {showStartChatModal && (
        <div className="modal-backdrop" onClick={() => setShowStartChatModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Start New Chat</h3>
            <input
              type="text"
              placeholder="Search users"
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              autoFocus
            />
            <ul className="available-users-list">
              {loadingUsers && <li>Loading users...</li>}
              {!loadingUsers && availableUsers.length === 0 && (
                <li>No users available to start a new chat</li>
              )}
              {!loadingUsers && availableUsers.length > 0 && filteredAvailableUsers.length === 0 && (
                <li>No users found matching "{searchUser}"</li>
              )}
              {!loadingUsers &&
                filteredAvailableUsers.map((user) => (
                  <li key={user.id} onClick={() => handleStartConversation(user)}>
                    {user.fullname}
                  </li>
                ))}
            </ul>
            <button onClick={() => setShowStartChatModal(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Messaging;
