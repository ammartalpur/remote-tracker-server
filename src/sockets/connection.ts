import { Server, Socket } from "socket.io";
import { handlePairingEvents } from "./pairing";
import { handleCaptureEvents } from "./capture";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const handleConnection = async (io: Server, socket: Socket) => {
  const { type, token, deviceId } = socket.handshake.auth;

  // 1. Identify if the connection is the Owner Dashboard
  if (type === "owner") {
    socket.join("owners_room");
    console.log(`[Socket] Owner Dashboard connected. ID: ${socket.id}`);
  }

  // 2. Identify if the connection is a Registered Desktop Software Client
  else if (type === "agent" && token && deviceId) {
    try {
      // Authenticate via database check
      const device = await prisma.device.findUnique({
        where: { id: deviceId, authToken: token },
      });

      if (device && device.isVerified) {
        socket.join(`device:${deviceId}`);

        // Create a new session for this exact connection
        const currentSession = await prisma.session.create({
          data: { deviceId: device.id },
        });

        // Store the Session ID and Start Time temporarily in the Socket's memory
        socket.data.sessionId = currentSession.id;
        socket.data.sessionStartTime = currentSession.startedAt;

        // Update presence state in database
        await prisma.device.update({
          where: { id: deviceId },
          data: { isActive: true },
        });

        console.log(
          `[Socket] Verified Agent connected: ${device.hostname} | Session: ${currentSession.id}`,
        );
        io.to("owners_room").emit("employee:online", { deviceId });
      } else {
        socket.emit("auth_error", {
          message: "Invalid machine registration token.",
        });
        socket.disconnect();
        return;
      }
    } catch (err) {
      console.error("[Socket Auth Error]", err);
      socket.disconnect();
      return;
    }
  }


  // --- HISTORY LOGGING (ACTIVE APP) ---
  socket.on(
    "agent:update_app",
    async (payload: { deviceId: string; appName: string }) => {
      

      try {
        await prisma.device.update({
          where: { id: payload.deviceId },
          data: { activeApp: payload.appName },
        });

        if (socket.data.sessionId) {
          await prisma.activityLog.create({
            data: {
              sessionId: socket.data.sessionId,
              appName: payload.appName,
            },
          });
        }

        io.to("owners_room").emit("employee:app_changed", {
          deviceId: payload.deviceId,
          activeApp: payload.appName,
        });
      } catch (err) {
        console.error("[Telemetry] Failed to update active app", err);
      }
    },
  );

  // Register feature event modules
  handlePairingEvents(io, socket);
  handleCaptureEvents(io, socket);

  // 3. Clean up and Clock-Out when a connection drops
  socket.on("disconnect", async () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);

    if (type === "agent" && deviceId) {
      try {
        // --- NEW: TIME TRACKING (CLOCK-OUT) ---
        if (socket.data.sessionId) {
          const endTime = new Date();
          const startTime = socket.data.sessionStartTime || new Date();

          // Calculate total minutes worked (minimum of 1 minute)
          const diffInMs = endTime.getTime() - startTime.getTime();
          const durationMin = Math.max(1, Math.round(diffInMs / 60000));

          // Close the session loop
          await prisma.session.update({
            where: { id: socket.data.sessionId },
            data: {
              endedAt: endTime,
              durationMin: durationMin,
            },
          });
        }

        // Update device to offline and clear the active app
        await prisma.device.update({
          where: { id: deviceId },
          data: { isActive: false, activeApp: null },
        });

        // Notify owner dashboard
        io.to("owners_room").emit("employee:offline", { deviceId });
      } catch (err) {
        console.error("[Disconnect Error]", err);
      }
    }
  });
};;
