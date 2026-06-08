import { Server, Socket } from "socket.io";
import { PrismaClient } from "@prisma/client"; // 🚀 Import Prisma

const prisma = new PrismaClient(); // 🚀 Initialize Prisma

export const handleCaptureEvents = (io: Server, socket: Socket) => {
  console.log(
    `📡 [Capture Module] Registered for socket connection: ${socket.id}`,
  );

  // 1. DASHBOARD ASKS FOR SCREENSHOT
  socket.on(
    "owner:trigger_screenshot",
    async (payload: { deviceId: string }) => {
      console.log(`\n🚨 [Capture Event] 'owner:request_capture' received!`);
      console.log(`   - Sender Socket ID: ${socket.id}`);
      console.log(`   - Target ID Received: ${payload?.deviceId}`);

      if (!payload || !payload.deviceId) {
        console.log(`   ❌ ERROR: Missing target ID in request!`);
        return;
      }

      let actualDeviceId = payload.deviceId;

      try {
        // 🧠 SMART LOOKUP: Check if the ID belongs to a device directly
        let targetDevice = await prisma.device.findUnique({
          where: { id: payload.deviceId },
        });

        // If it's NOT a device, check if it's an Employee ID from the frontend URL
        if (!targetDevice) {
          console.log(
            `   🔍 ID is not a device. Checking if it's an Employee ID...`,
          );
          const targetEmployee = await prisma.employee.findUnique({
            where: { id: payload.deviceId },
            include: { devices: true }, // Grab their linked devices
          });

          if (targetEmployee && targetEmployee.devices.length > 0) {
            // Use the first linked device (or filter by isActive: true if you prefer)
            actualDeviceId = targetEmployee.devices[0].id;
            console.log(
              `   ✅ Matched Employee to Device ID: ${actualDeviceId}`,
            );
          } else {
            console.log(
              `   ❌ ERROR: Could not find any device linked to this ID.`,
            );
            socket.emit("owner:error", {
              message: "Target device is offline or does not exist.",
            });
            return;
          }
        }

        const roomName = `device:${actualDeviceId}`;

        const room = io.sockets.adapter.rooms.get(roomName);
        const clientCount = room ? room.size : 0;
        console.log(`   - Attempting to forward to room: "${roomName}"`);
        console.log(
          `   - Active verified agents listening in this room: ${clientCount}`,
        );

        if (clientCount === 0) {
          console.log(
            `   ⚠️ WARNING: Sending message to an empty room! The agent is offline or crashed.`,
          );
          socket.emit("owner:error", {
            message: "The employee's desktop app is currently offline.",
          });
          return; // Don't bother sending the request if no one is listening
        }

        // Forward the command to the CORRECT agent room
        // io.to(roomName).emit("owner:request_capture");
        io.to(roomName).emit("agent:request_capture");
        console.log(
          `   ✅ Event 'agent:request_capture' successfully emitted!`,
        );
      } catch (error) {
        console.error(`   ❌ Database lookup failed:`, error);
      }
    },
  );

  // 2. ELECTRON APP SENDS THE PICTURE BACK
  socket.on("agent:upload_result", (payload) => {
    console.log(`📸 [Server] agent:upload_result received`);
    console.log(`   - deviceId: ${payload?.deviceId}`);
    console.log(`   - image present: ${!!payload?.image}`);
    console.log(`   - image length: ${payload?.image?.length}`);

    const roomSockets = io.sockets.adapter.rooms.get("owners_room");
    console.log(`   - owners_room size: ${roomSockets?.size ?? 0}`);

    io.to("owners_room").emit("owner:capture_result", {
      // ← fix the name here too
      deviceId: payload.deviceId,
      image: payload.image,
    });
    console.log(`   ✅ Forwarded to owners_room as owner:capture_result`);
  });
};
