import React, { createContext, useState, useContext, useEffect } from "react";

const OnlineStatusContext = createContext();

export function OnlineStatusProvider({ children }) {
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const updateStatus = ({ userId, isOnline }) => {
    setOnlineUsers((prev) => {
      const updated = new Set(prev);
      if (isOnline) updated.add(userId);
      else updated.delete(userId);
      return updated;
    });
  };

  // Fetch initial online users on mount
  useEffect(() => {
    const fetchOnlineUsers = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch("http://localhost:3300/api/user-status", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error("Failed to fetch online users");
          return;
        }

        const data = await response.json();
        // data.onlineUsers expected to be an array of user IDs
        setOnlineUsers(new Set(data.onlineUsers));
      } catch (err) {
        console.error("Error fetching online users:", err);
      }
    };

    fetchOnlineUsers();
  }, []);

  return (
    <OnlineStatusContext.Provider value={{ onlineUsers, updateStatus }}>
      {children}
    </OnlineStatusContext.Provider>
  );
}

export function useOnlineStatus() {
  return useContext(OnlineStatusContext);
}
