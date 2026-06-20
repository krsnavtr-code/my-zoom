import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import Meeting from "./models/Meeting.js";

import dns from "dns";

// Only set DNS in development/local environment
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
}

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// MongoDB Connection
mongoose
  .connect(process.env.DB)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Use routes
app.use("/api/auth", authRoutes);
app.use("/api/meeting", meetingRoutes);

// Socket.io setup for Real-time communication
const io = new Server(server, {
  cors: {
    origin: "*", // Allow any origin for local network/tunnel connections
    methods: ["GET", "POST"],
  },
});

// Room state management
const rooms = new Map();

// Chat message storage (in-memory for session)
const chatMessages = new Map();

// Meeting timers for auto-end
const meetingTimers = new Map();

// Meeting settings per room
const meetingSettings = new Map();

// Auto-start scheduled meetings
const autoStartScheduledMeetings = async () => {
  try {
    const now = new Date();
    const scheduledMeetings = await Meeting.find({
      type: "scheduled",
      status: "scheduled",
      scheduledDate: { $lte: now },
    });

    for (const meeting of scheduledMeetings) {
      // Parse scheduled time to get the full scheduled datetime
      const scheduledDateTime = new Date(meeting.scheduledDate);
      const [hours, minutes] = meeting.scheduledTime.split(":");
      scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // If scheduled time has passed, activate the meeting
      if (scheduledDateTime <= now) {
        await Meeting.findOneAndUpdate(
          { meetingId: meeting.meetingId },
          { status: "active", startTime: new Date() },
        );
        console.log(`Auto-started meeting ${meeting.meetingId}`);
      }
    }
  } catch (error) {
    console.error("Error auto-starting scheduled meetings:", error);
  }
};

// Check every minute for scheduled meetings to start
setInterval(autoStartScheduledMeetings, 60000);

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Room join logic
  socket.on("join-room", async (roomId, userId, userName) => {
    console.log(`\n--- 🚀 NEW JOIN REQUEST ---`);
    console.log(`📥 Room: ${roomId} | UserID: ${userId} | Name: ${userName}`);
    // Store roomId in socket for use in other handlers
    socket.roomId = roomId;
    socket.userId = userId;

    // Check if meeting has ended
    try {
      const meeting = await Meeting.findOne({ meetingId: roomId });
      if (meeting && meeting.status === "ended") {
        console.log(`🚫 Meeting already ended. Bouncing user.`);
        socket.emit("meeting-ended", { roomId, reason: "already_ended" });
        return;
      }
    } catch (error) {
      console.error("Error checking meeting status:", error);
    }

    socket.join(roomId);
    console.log(`✅ Socket successfully joined room ID: ${roomId}`);

    // Initialize room if not exists
    if (!rooms.has(roomId)) {
      console.log(`🏠 Creating fresh room state for: ${roomId}`);
      rooms.set(roomId, new Map());
      // First user becomes host
      meetingSettings.set(roomId, {
        hostId: userId,
        isLocked: false,
        chatEnabled: true,
        screenShareEnabled: true,
      });

      // Check if this is a scheduled meeting and set auto-end timer
      Meeting.findOne({ meetingId: roomId })
        .then(async (meeting) => {
          if (
            meeting &&
            meeting.type === "scheduled" &&
            meeting.duration &&
            meeting.status !== "ended"
          ) {
            // Set startTime if not already set (meeting is actually starting now)
            if (!meeting.startTime) {
              await Meeting.findOneAndUpdate(
                { meetingId: roomId },
                { startTime: new Date() },
              );
            }

            // Calculate end time based on actual startTime + duration
            const updatedMeeting = await Meeting.findOne({ meetingId: roomId });
            const startTime = updatedMeeting.startTime || new Date();
            const endTime = new Date(
              startTime.getTime() + meeting.duration * 60000,
            );
            const now = new Date();
            const timeUntilEnd = endTime.getTime() - now.getTime();

            if (timeUntilEnd > 0) {
              // Set timer to auto-end meeting
              const timer = setTimeout(async () => {
                console.log(
                  `Auto-ending meeting ${roomId} due to duration expiry`,
                );

                // Update meeting status in DB
                await Meeting.findOneAndUpdate(
                  { meetingId: roomId },
                  {
                    status: "ended",
                    endTime: new Date(),
                  },
                );

                // Notify all users
                io.to(roomId).emit("meeting-ended", {
                  roomId,
                  reason: "duration_expired",
                });

                // Disconnect all users
                if (rooms.has(roomId)) {
                  const room = rooms.get(roomId);
                  room.forEach((user) => {
                    const userSocket = io.sockets.sockets.get(user.socketId);
                    if (userSocket) {
                      userSocket.leave(roomId);
                    }
                  });
                  rooms.delete(roomId);
                }

                // Clear settings
                if (meetingSettings.has(roomId)) {
                  meetingSettings.delete(roomId);
                }

                // Clear timer
                meetingTimers.delete(roomId);
              }, timeUntilEnd);

              meetingTimers.set(roomId, timer);
            }
          }
        })
        .catch((err) => {
          console.error("Error checking meeting for auto-end:", err);
        });
    }

    // Add user to room
    rooms.get(roomId).set(userId, {
      socketId: socket.id,
      userName: userName || "Guest",
      audioEnabled: true,
      videoEnabled: true,
      isScreenSharing: false,
      handRaised: false,
    });

    // Get current users in room
    const roomUsers = Array.from(rooms.get(roomId).keys()).filter(
      (id) => id !== userId,
    );

    console.log(`👥 Other users currently in room:`, roomUsers);

    // Get user names for existing users
    const userNames = {};
    roomUsers.forEach((id) => {
      if (rooms.get(roomId).has(id)) {
        userNames[id] = rooms.get(roomId).get(id).userName;
      }
    });

    // Notify existing users
    socket.to(roomId).emit("user-connected", { userId, userName });
    console.log(`📤 Emitted 'user-connected' to other participants.`);

    // Send current users to new user
    socket.emit("room-users", roomUsers);
    console.log(`📤 Emitted 'room-users' to the newly joined user.`);

    // Send user names to new user
    socket.emit("user-names", userNames);

    // Send meeting settings to user
    if (meetingSettings.has(roomId)) {
      socket.emit("meeting-settings", meetingSettings.get(roomId));
    }
    console.log(`--- ✨ JOIN PROCESS COMPLETE ---\n`);

    socket.on("disconnect", () => {
      const roomId = socket.roomId;
      const userId = socket.userId;

      if (roomId && userId && rooms.has(roomId)) {
        const room = rooms.get(roomId);
        const user = room.get(userId);
        if (user && user.socketId === socket.id) {
          socket.to(roomId).emit("user-disconnected", userId);
          room.delete(userId);
          if (room.size === 0) {
            rooms.delete(roomId);
          }
        }
      }
    });
  });

  // WebRTC signaling
  socket.on("call-user", ({ userToCall, signalData, from }) => {
    const roomId = socket.roomId;
    if (!roomId) return;

    if (rooms.has(roomId)) {
      const targetUser = rooms.get(roomId).get(userToCall);
      if (targetUser) {
        socket
          .to(targetUser.socketId)
          .emit("call-user", { signal: signalData, callerId: from });
      }
    }
  });

  socket.on("call-accepted", ({ signal, callId }) => {
    const roomId = socket.roomId;
    if (!roomId) return;

    if (rooms.has(roomId)) {
      const targetUser = rooms.get(roomId).get(callId);
      if (targetUser) {
        // YAHAN FIX HAI: 'callId' ki jagah 'socket.userId' bhejna zaroori hai
        socket
          .to(targetUser.socketId)
          .emit("call-accepted", { signal, callId: socket.userId });
      }
    }
  });

  socket.on("ice-candidate", ({ candidate, to }) => {
    const roomId = socket.roomId;
    if (!roomId) return;

    if (rooms.has(roomId)) {
      const targetUser = rooms.get(roomId).get(to);
      if (targetUser) {
        // YAHAN FIX HAI: 'from: socket.id' ki jagah 'from: socket.userId' aayega
        socket
          .to(targetUser.socketId)
          .emit("ice-candidate", { candidate, from: socket.userId });
      }
    }
  });

  // --- NAYA HANDSHAKE EVENT ---
  // Jab naya user fully ready ho jayega, toh wo baakiyo ko signal bhejega
  socket.on("ready-for-calls", (roomId, userId, userName) => {
    console.log(
      `🛎️ User ${userName} (${userId}) is fully ready for calls in room ${roomId}`,
    );
    socket.to(roomId).emit("user-ready", { userId, userName });
  });

  // Audio state sync
  socket.on("toggle-audio", ({ roomId, userId, audioEnabled }) => {
    // Update room state
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      if (room.has(userId)) {
        room.get(userId).audioEnabled = audioEnabled;
      }
    }
    // Broadcast to all users in room
    socket.to(roomId).emit("user-audio-toggled", { userId, audioEnabled });
  });

  // Video state sync
  socket.on("toggle-video", ({ roomId, userId, videoEnabled }) => {
    // Update room state
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      if (room.has(userId)) {
        room.get(userId).videoEnabled = videoEnabled;
      }
    }
    // Broadcast to all users in room
    socket.to(roomId).emit("user-video-toggled", { userId, videoEnabled });
  });

  // Screen share state sync
  socket.on("toggle-screen-share", ({ roomId, userId, isScreenSharing }) => {
    // Update room state
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      if (room.has(userId)) {
        room.get(userId).isScreenSharing = isScreenSharing;
      }
    }
    // Broadcast to all users in room
    socket
      .to(roomId)
      .emit("user-screen-share-toggled", { userId, isScreenSharing });
  });

  // Leave room
  socket.on("leave-room", (roomId, userId) => {
    socket.leave(roomId);
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const user = room.get(userId);

      if (user && user.socketId === socket.id) {
        socket.to(roomId).emit("user-disconnected", userId);
        room.delete(userId);
        if (room.size === 0) {
          rooms.delete(roomId);
        }
      }
    }
  });

  // Get room participants
  socket.on("get-participants", (roomId) => {
    if (rooms.has(roomId)) {
      const participants = Array.from(rooms.get(roomId).entries()).map(
        ([userId, data]) => ({
          userId,
          userName: data.userName,
          audioEnabled: data.audioEnabled,
          videoEnabled: data.videoEnabled,
        }),
      );
      socket.emit("participants-list", participants);
    }
  });

  // Chat messaging
  socket.on("send-message", ({ roomId, userId, userName, message }) => {
    const messageData = {
      id: Date.now().toString(),
      userId,
      userName,
      message,
      timestamp: new Date().toISOString(),
    };

    // Store message in memory
    if (!chatMessages.has(roomId)) {
      chatMessages.set(roomId, []);
    }
    const roomMessages = chatMessages.get(roomId);
    roomMessages.push(messageData);

    // Keep only last 100 messages per room
    if (roomMessages.length > 100) {
      roomMessages.shift();
    }

    // Broadcast to all users in room
    io.to(roomId).emit("receive-message", messageData);
  });

  // Get message history
  socket.on("get-message-history", (roomId) => {
    if (chatMessages.has(roomId)) {
      socket.emit("message-history", chatMessages.get(roomId));
    } else {
      socket.emit("message-history", []);
    }
  });

  // Raise hand
  socket.on("raise-hand", ({ roomId, userId, isRaised }) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      if (room.has(userId)) {
        room.get(userId).handRaised = isRaised;
      }
      // Notify host
      if (meetingSettings.has(roomId)) {
        const settings = meetingSettings.get(roomId);
        const hostUser = room.get(settings.hostId);
        if (hostUser) {
          const hostSocket = io.sockets.sockets.get(hostUser.socketId);
          if (hostSocket) {
            hostSocket.emit("hand-raised", { userId, isRaised });
          }
        }
      }
      // Broadcast to all
      io.to(roomId).emit("hand-raised", { userId, isRaised });
    }
  });

  // End meeting
  socket.on("end-meeting", ({ roomId }) => {
    // Notify all users in the room that meeting has ended
    io.to(roomId).emit("meeting-ended", { roomId });

    // Disconnect all users from the room
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.forEach((user) => {
        const userSocket = io.sockets.sockets.get(user.socketId);
        if (userSocket) {
          userSocket.leave(roomId);
        }
      });
      rooms.delete(roomId);
    }

    // Clear meeting settings
    if (meetingSettings.has(roomId)) {
      meetingSettings.delete(roomId);
    }
  });

  // Kick participant (host only)
  socket.on("kick-participant", ({ roomId, hostId, participantId }) => {
    if (meetingSettings.has(roomId)) {
      const settings = meetingSettings.get(roomId);
      if (settings.hostId === hostId && rooms.has(roomId)) {
        const room = rooms.get(roomId);
        const participant = room.get(participantId);
        if (participant) {
          // Notify kicked user
          const participantSocket = io.sockets.sockets.get(
            participant.socketId,
          );
          if (participantSocket) {
            participantSocket.emit("kicked-from-room");
            participantSocket.leave(roomId);
          }
          // Remove from room
          room.delete(participantId);
          // Notify all
          io.to(roomId).emit("user-kicked", { userId: participantId });
        }
      }
    }
  });

  // Lock meeting (host only)
  socket.on("lock-meeting", ({ roomId, hostId, isLocked }) => {
    if (meetingSettings.has(roomId)) {
      const settings = meetingSettings.get(roomId);
      if (settings.hostId === hostId) {
        settings.isLocked = isLocked;
        meetingSettings.set(roomId, settings);
        // Broadcast to all
        io.to(roomId).emit("meeting-locked", { isLocked });
      }
    }
  });

  // Mute all (host only)
  socket.on("mute-all", ({ roomId, hostId }) => {
    if (meetingSettings.has(roomId)) {
      const settings = meetingSettings.get(roomId);
      if (settings.hostId === hostId && rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.forEach((user, userId) => {
          if (userId !== hostId) {
            user.audioEnabled = false;
            const userSocket = io.sockets.sockets.get(user.socketId);
            if (userSocket) {
              userSocket.emit("force-mute");
            }
          }
        });
        // Broadcast to all
        io.to(roomId).emit("all-muted");
      }
    }
  });

  // Update meeting settings (host only)
  socket.on("update-settings", ({ roomId, hostId, settings }) => {
    if (meetingSettings.has(roomId)) {
      const currentSettings = meetingSettings.get(roomId);
      if (currentSettings.hostId === hostId) {
        const updatedSettings = { ...currentSettings, ...settings };
        meetingSettings.set(roomId, updatedSettings);
        // Broadcast to all
        io.to(roomId).emit("meeting-settings", updatedSettings);
      }
    }
  });
});

const PORT = process.env.PORT || 7002;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
