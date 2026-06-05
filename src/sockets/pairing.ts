import { Server, Socket } from "socket.io";
import { OtpService } from "../services/otp.service";
import { GeoIpService } from "../services/geoip.service";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env";

const prisma = new PrismaClient();

interface UnverifiedPayload {
  hostname: string;
  os: string;
  macAddress: string;
  ip: string; // 🚀 FIX: Matched exactly to the new Electron payload
  location?: string;
}

// NEW: A temporary waiting room for devices that entered the correct OTP but need Admin approval
const pendingAdminApprovals = new Map<string, any>();

export const handlePairingEvents = (io: Server, socket: Socket) => {
  // 1. Desktop requests pairing
  socket.on("agent:request_pairing", async (payload: UnverifiedPayload) => {
    console.log(`[Pairing] Request received from machine: ${payload.hostname}`);

    const location =
      payload.location || (await GeoIpService.getLocationByIp(payload.ip)); // 🚀 FIX: Read .ip

    const otpCode = OtpService.generateOtp({
      socketId: socket.id,
      hostname: payload.hostname,
      os: payload.os,
      macAddress: payload.macAddress,
      ip: payload.ip, // 🚀 FIX: Pass .ip to the OTP Service
      location: location,
    });

    io.to("owners_room").emit("owner:new_pairing_request", {
      hostname: payload.hostname,
      ip: payload.ip, // 🚀 FIX: Send .ip to the Dashboard Modal
      location: location,
      otp: otpCode,
      macAddress: payload.macAddress,
    });
  });

  // 2. Employee types the OTP in the desktop app
  socket.on(
    "agent:submit_otp",
    async (payload: { macAddress: string; otp: string }) => {
      const verifiedData = OtpService.verifyOtp(
        payload.macAddress,
        payload.otp,
      );

      if (!verifiedData) {
        return socket.emit("pairing_error", {
          message: "Invalid or expired OTP code.",
        });
      }

      // Move the device to the waiting room
      pendingAdminApprovals.set(payload.macAddress, verifiedData);

      // Tell the desktop app to switch to the "Waiting for Admin" screen
      socket.emit("pairing_status", { status: "waiting_admin_approval" });
    },
  );

  // 3. NEW: Owner clicks "Approve & Connect" on the Dashboard
  socket.on(
    "owner:approve_device",
    async (payload: { macAddress: string; employeeName: string }) => {
      const deviceData = pendingAdminApprovals.get(payload.macAddress);

      if (!deviceData) {
        return socket.emit("owner:error", {
          message: "Device not found or OTP expired.",
        });
      }

      try {
        // Create the database record WITH the owner's provided name
        const newEmployee = await prisma.employee.create({
          data: {
            name: payload.employeeName, // Using the name typed in the modal!
            devices: {
              create: {
                hostname: deviceData.hostname,
                os: deviceData.os,
                macAddress: deviceData.macAddress,
                lastIp: deviceData.ip || "Unknown IP", // 🚀 FIX: Perfectly maps the IP to Prisma
                location: deviceData.location,
                isVerified: true,
                isActive: true,
                authToken: "",
              },
            },
          },
          include: { devices: true },
        });

        const createdDevice = newEmployee.devices[0];

        const generatedToken = jwt.sign(
          { deviceId: createdDevice.id, macAddress: createdDevice.macAddress },
          ENV.JWT_SECRET,
        );

        await prisma.device.update({
          where: { id: createdDevice.id },
          data: { authToken: generatedToken },
        });

        // Deliver the final unlock key specifically to the waiting Desktop app
        io.to(deviceData.socketId).emit("pairing_response", {
          success: true,
          deviceId: createdDevice.id,
          token: generatedToken,
        });

        // Clean up memory and refresh dashboard
        pendingAdminApprovals.delete(payload.macAddress);
        io.to("owners_room").emit("owner:pairing_success");
      } catch (error) {
        console.error("[Database Registration Error]", error);
      }
    },
  );
};
