import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "../styles/AIassistant.css";

const API_BASE = "http://localhost:3300/api/chatbot";
const SOCKET_URL = "http://localhost:3300";

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [session, setSession] = useState({ role: null, level: null });
  const chatRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: false,
    });

    socketRef.current.on("connect", () => {
      console.log("Socket connected:", socketRef.current.id);
    });

    socketRef.current.on("new_notification", (notif) => {
      addMessage({ sender: "ai", text: `🔔 ${notif.title}: ${notif.message}` });
    });

    socketRef.current.connect();

    return () => socketRef.current.disconnect();
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Fetch initial menu when chat opens
  useEffect(() => {
    if (open && !session.role) {
      fetchMenu();
    }
  }, [open]);

  function addMessage(message) {
    setMessages((msgs) => [...msgs, message]);
  }

  async function fetchMenu() {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/menu`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSession({ role: data.role, level: "main" }); // start at main menu
      addMessage({
        sender: "ai",
        text: `🤖 Welcome! You are logged in as *${data.role}*.\n\n${data.menuText}`,
      });
      setLoading(false);
    } catch (e) {
      setError("Failed to load menu. Please try again.");
      setLoading(false);
    }
  }

  // Send user input (option selected or typed) to backend
  async function sendInput(userInput) {
    if (!userInput.trim()) return;

    addMessage({ sender: "user", text: userInput });
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/input`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ input: userInput, level: session.level }),
      });
      const data = await res.json();

      if (Array.isArray(data.reply)) {
        data.reply.forEach((r) => addMessage({ sender: "ai", text: r }));
      } else {
        addMessage({ sender: "ai", text: data.reply });
      }

      // Update session level for menu navigation (backend controls this)
      setSession((s) => ({ ...s, level: data.nextLevel || s.level }));
      setLoading(false);
    } catch (e) {
      setError("Error communicating with chatbot.");
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    sendInput(input);
  }

  function handleOptionClick(optionText) {
    sendInput(optionText);
  }

  // Parse numbered menu options (1. Option text or 1) Option text)
  function parseOptionsFromText(text) {
    const lines = text.split("\n");
    const options = lines
      .filter((line) => /^\s*\d+[\.\)]\s/.test(line))
      .map((line) => line.trim().replace(/^\d+[\.\)]\s*/, ""));
    return options.length > 0 ? options : null;
  }

  // Get options from last AI message for buttons
  const lastAiMessage = messages
    .slice()
    .reverse()
    .find((m) => m.sender === "ai");
  const options = lastAiMessage ? parseOptionsFromText(lastAiMessage.text) : null;

  return (
    <>
      <button
        className="ai-assistant-button"
        aria-label={open ? "Close chatbot" : "Open chatbot"}
        onClick={() => setOpen((o) => !o)}
        style={{ display: open ? "none" : "flex" }}
      >
        🤖
      </button>

      {open && (
        <>
          <div
            className="ai-assistant-overlay"
            onClick={() => setOpen(false)}
            aria-label="Close chatbot by clicking outside"
          ></div>

          <section
            className="ai-assistant-panel"
            role="dialog"
            aria-modal="true"
            aria-label="EMS AI Assistant Chatbot"
          >
            <header className="ai-assistant-header">
              <h2>EMS Assistant</h2>
              <button
                className="ai-assistant-close-btn"
                aria-label="Close chatbot"
                onClick={() => setOpen(false)}
              >
                ✖
              </button>
            </header>

            <div className="ai-assistant-chat" ref={chatRef}>
              {messages.length === 0 && (
                <p className="ai-assistant-empty-text">No messages yet. Say hi!</p>
              )}
              {messages.map((msg, i) => {
                const isUser = msg.sender === "user";
                const parts = msg.text.split(/(\*\*[^*]+\*\*)/);
                return (
                  <div
                    key={i}
                    className={`ai-assistant-message ${
                      isUser ? "user-message" : "ai-message"
                    }`}
                    aria-live="polite"
                  >
                    {parts.map((part, idx) =>
                      part.startsWith("**") && part.endsWith("**") ? (
                        <strong key={idx} className="bold-text">
                          {part.slice(2, -2)}
                        </strong>
                      ) : (
                        <span key={idx}>{part}</span>
                      )
                    )}
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}

            {loading && (
              <div className="loading-wrapper">
                <div className="loading-spinner" aria-hidden="true"></div> Loading...
              </div>
            )}

            <form
              className="ai-assistant-input-area"
              onSubmit={handleSubmit}
              aria-label="Send message"
            >
              <input
                className="ai-assistant-input"
                type="text"
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                aria-disabled={loading}
                autoComplete="off"
                autoFocus
              />
              <button
                className="ai-assistant-send-btn"
                type="submit"
                disabled={loading || !input.trim()}
                aria-disabled={loading || !input.trim()}
                aria-label="Send message"
              >
                ➤
              </button>
            </form>

            {options && (
              <div
                className="chatbot-options"
                role="list"
                aria-label="Chatbot options"
                style={{ padding: "0 20px 16px" }}
              >
                {/* Show Back button if not main menu */}
                {session.level !== "main" && (
                  <button
                    className="ai-assistant-option-btn"
                    onClick={() => handleOptionClick("back")}
                    type="button"
                  >
                    ← Back
                  </button>
                )}

                {options.map((opt, idx) => (
                  <button
                    key={idx}
                    className="ai-assistant-option-btn"
                    onClick={() => handleOptionClick(opt)}
                    type="button"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
