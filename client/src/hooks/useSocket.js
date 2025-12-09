import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import axiosInstance from "@/api/axiosInstance";

export function useSocket(groupId) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineMembers, setOnlineMembers] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!groupId) return;

    // Get auth token
    const token = JSON.parse(sessionStorage.getItem("accessToken")) || "";

    if (!token) {
      console.error("No auth token found");
      return;
    }

    // Create socket connection
    const socketInstance = io(import.meta.env.VITE_API_URL || "http://localhost:5000", {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    // Connection events
    socketInstance.on("connect", () => {
      console.log("Socket connected:", socketInstance.id);
      setIsConnected(true);
      
      // Join group room
      socketInstance.emit("join-group", groupId);
    });

    socketInstance.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    socketInstance.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setIsConnected(false);
    });

    // Group events
    socketInstance.on("user-joined", (data) => {
      console.log("User joined:", data);
    });

    socketInstance.on("user-left", (data) => {
      console.log("User left:", data);
    });

    socketInstance.on("online-members", (data) => {
      if (data.groupId === groupId) {
        setOnlineMembers(data.members || []);
      }
    });

    // Cleanup
    return () => {
      if (socketInstance) {
        socketInstance.emit("leave-group", groupId);
        socketInstance.disconnect();
      }
    };
  }, [groupId]);

  return {
    socket: socketRef.current || socket,
    isConnected,
    onlineMembers,
  };
}

