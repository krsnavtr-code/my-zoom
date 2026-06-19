import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";

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

// Socket.io setup for Real-time communication
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Vite ka default port
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Room join logic
  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-connected", userId);

    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected", userId);
    });
  });

  // WebRTC signaling
  socket.on("call-user", ({ userToCall, signalData, from }) => {
    socket.to(userToCall).emit("call-user", { signal, callerId: from });
  });

  socket.on("call-accepted", ({ signal, callId }) => {
    socket.to(callId).emit("call-accepted", { signal, callId });
  });

  socket.on("leave-room", (roomId, userId) => {
    socket.leave(roomId);
    socket.to(roomId).emit("user-disconnected", userId);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
