import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { ENV } from "../config/env";
import { handleConnection } from "./connection";

export const initializeSockets = (httpServer: HttpServer): SocketIOServer => {
  const io = new SocketIOServer(httpServer, {
    // 🚀 THE FIX: Increase the maximum payload size to 10MB (1e7 bytes)
    maxHttpBufferSize: 1e7,
    cors: {
      // 🚀 THE CLOUDFLARE FIX: Allow all origins so the tunnel can bridge the gap
      origin: "*",
      methods: ["GET", "POST"],
      // credentials: true, // ⚠️ MUST be removed or commented out when using origin: "*"
    },
  });

  io.on("connection", (socket) => {
    // Pass off the fresh connection to your presence controller
    handleConnection(io, socket);
  });

  return io;
};
