import React, { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useOnlineStatus } from "./OnlineStatusContext";
import API_BASE_URL from "./api";  // import your base URL here

export default function SocketManager({ isAuthenticated, userId }) {
  const socketRef = useRef();
  const { updateStatus } = useOnlineStatus();

  useEffect(() => {
    if (isAuthenticated && userId) {
      const socket = io(API_BASE_URL, {  // use the centralized URL here
        query: { userId },
        withCredentials: true,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("Socket connected", socket.id);
        socket.emit("identify", userId);
      });

      socket.on("user-status-update", ({ userId, isOnline }) => {
        console.log(`User ${userId} is now ${isOnline ? "online" : "offline"}`);
        updateStatus({ userId, isOnline });
      });

      socket.on("disconnect", () => {
        console.log("Socket disconnected");
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [isAuthenticated, userId, updateStatus]);

  return null;
}
