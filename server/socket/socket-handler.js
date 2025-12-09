const jwt = require("jsonwebtoken");
const GroupMessage = require("../models/GroupMessage");
const GroupResource = require("../models/GroupResource");
const GroupTask = require("../models/GroupTask");
const Group = require("../models/Group");

const JWT_SECRET = process.env.JWT_SECRET || "JWT_SECRET";

// Store online users: { userId: { socketId, groups: [groupId1, groupId2] } }
const onlineUsers = new Map();

// Authenticate socket connection
function authenticateSocket(socket, next) {
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1];

  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded._id;
    socket.userName = decoded.userName;
    socket.userEmail = decoded.userEmail;
    next();
  } catch (err) {
    next(new Error("Authentication error: Invalid token"));
  }
}

function setupSocketIO(io) {
  // Authentication middleware
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.userName} (${socket.userId})`);

    // Track user as online
    if (!onlineUsers.has(socket.userId)) {
      onlineUsers.set(socket.userId, { socketId: socket.id, groups: [] });
    }

    // Join group rooms
    socket.on("join-group", async (groupId) => {
      try {
        const group = await Group.findById(groupId);
        if (!group) {
          return socket.emit("error", { message: "Group not found" });
        }

        const isMember = group.members.some(
          (m) => m.userId.toString() === socket.userId
        );

        if (!isMember) {
          return socket.emit("error", { message: "You are not a member of this group" });
        }

        socket.join(`group:${groupId}`);
        
        // Track group membership
        const userData = onlineUsers.get(socket.userId);
        if (userData && !userData.groups.includes(groupId)) {
          userData.groups.push(groupId);
        }

        // Notify others in the group
        socket.to(`group:${groupId}`).emit("user-joined", {
          userId: socket.userId,
          userName: socket.userName,
        });

        // Send online status to the user
        const onlineMembers = [];
        for (const [userId, data] of onlineUsers.entries()) {
          if (data.groups.includes(groupId)) {
            onlineMembers.push(userId);
          }
        }
        socket.emit("online-members", { groupId, members: onlineMembers });

        console.log(`User ${socket.userName} joined group ${groupId}`);
      } catch (error) {
        console.error("Error joining group:", error);
        socket.emit("error", { message: "Failed to join group" });
      }
    });

    // Leave group room
    socket.on("leave-group", (groupId) => {
      socket.leave(`group:${groupId}`);
      
      const userData = onlineUsers.get(socket.userId);
      if (userData) {
        userData.groups = userData.groups.filter((g) => g !== groupId);
      }

      socket.to(`group:${groupId}`).emit("user-left", {
        userId: socket.userId,
        userName: socket.userName,
      });

      console.log(`User ${socket.userName} left group ${groupId}`);
    });

    // Handle new message
    socket.on("send-message", async (data) => {
      try {
        const { groupId, text } = data;

        if (!text || !text.trim()) {
          return socket.emit("error", { message: "Message text is required" });
        }

        const group = await Group.findById(groupId);
        if (!group) {
          return socket.emit("error", { message: "Group not found" });
        }

        const isMember = group.members.some(
          (m) => m.userId.toString() === socket.userId
        );

        if (!isMember) {
          return socket.emit("error", { message: "You are not a member of this group" });
        }

        const message = await GroupMessage.create({
          groupId,
          senderId: socket.userId,
          text: text.trim(),
        });

        await message.populate("senderId", "userName userEmail");

        // Broadcast to all members in the group
        io.to(`group:${groupId}`).emit("new-message", {
          message: message.toObject(),
        });

        console.log(`Message sent in group ${groupId} by ${socket.userName}`);
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Handle new resource
    socket.on("new-resource", async (data) => {
      try {
        const { groupId, resource } = data;
        const group = await Group.findById(groupId);

        if (!group) {
          return socket.emit("error", { message: "Group not found" });
        }

        const isMember = group.members.some(
          (m) => m.userId.toString() === socket.userId
        );

        if (!isMember) {
          return socket.emit("error", { message: "You are not a member of this group" });
        }

        // Broadcast to all members except sender
        socket.to(`group:${groupId}`).emit("resource-added", {
          resource,
          addedBy: {
            _id: socket.userId,
            userName: socket.userName,
          },
        });
      } catch (error) {
        console.error("Error broadcasting resource:", error);
      }
    });

    // Handle new task
    socket.on("new-task", async (data) => {
      try {
        const { groupId, task } = data;
        const group = await Group.findById(groupId);

        if (!group) {
          return socket.emit("error", { message: "Group not found" });
        }

        const isMember = group.members.some(
          (m) => m.userId.toString() === socket.userId
        );

        if (!isMember) {
          return socket.emit("error", { message: "You are not a member of this group" });
        }

        // Broadcast to all members except sender
        socket.to(`group:${groupId}`).emit("task-added", {
          task,
          assignedBy: {
            _id: socket.userId,
            userName: socket.userName,
          },
        });
      } catch (error) {
        console.error("Error broadcasting task:", error);
      }
    });

    // Handle task status update
    socket.on("task-updated", async (data) => {
      try {
        const { groupId, taskId, status } = data;
        const group = await Group.findById(groupId);

        if (!group) {
          return socket.emit("error", { message: "Group not found" });
        }

        // Broadcast to all members in the group
        io.to(`group:${groupId}`).emit("task-status-changed", {
          taskId,
          status,
          updatedBy: {
            _id: socket.userId,
            userName: socket.userName,
          },
        });
      } catch (error) {
        console.error("Error broadcasting task update:", error);
      }
    });

    // Handle typing indicator
    socket.on("typing", (data) => {
      const { groupId, isTyping } = data;
      socket.to(`group:${groupId}`).emit("user-typing", {
        userId: socket.userId,
        userName: socket.userName,
        isTyping,
      });
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.userName} (${socket.userId})`);

      const userData = onlineUsers.get(socket.userId);
      if (userData) {
        // Notify all groups user was in
        userData.groups.forEach((groupId) => {
          socket.to(`group:${groupId}`).emit("user-left", {
            userId: socket.userId,
            userName: socket.userName,
          });
        });

        // Remove from online users if this was their only socket
        if (userData.socketId === socket.id) {
          onlineUsers.delete(socket.userId);
        }
      }
    });
  });

  return io;
}

// Helper function to get online status
function getOnlineStatus(userId) {
  return onlineUsers.has(userId);
}

// Helper function to get online members of a group
function getOnlineMembers(groupId) {
  const members = [];
  for (const [userId, data] of onlineUsers.entries()) {
    if (data.groups.includes(groupId)) {
      members.push(userId);
    }
  }
  return members;
}

module.exports = { setupSocketIO, getOnlineStatus, getOnlineMembers };

