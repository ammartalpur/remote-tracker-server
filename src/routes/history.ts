import express from "express";
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.post("/upload", async (req, res) => {
  const { deviceId, imageBase64 } = req.body;

  if (!deviceId || !imageBase64) {
    return res.status(400).json({ error: "Missing data" });
  }

  try {
    // 🔍 STEP A: Look up who owns this device right now
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      select: { employeeId: true },
    });

    if (!device || !device.employeeId) {
      console.log(
        `❌ [Server] Upload rejected: Device ${deviceId} has no linked Employee.`,
      );
      return res.status(400).json({ error: "Orphaned device cannot upload" });
    }

    // ☁️ STEP B: Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(imageBase64, {
      folder: `remote_tracker/${device.employeeId}`,
      resource_type: "image",
    });

    // 💾 STEP C: Save to the Employee in the database
    const screenshot = await prisma.screenshot.create({
      data: {
        employeeId: device.employeeId,
        imageUrl: uploadResult.secure_url,
      },
    });

    console.log(
      `🎉 [Server] Saved screenshot directly to Employee: ${device.employeeId}`,
    );
    res.json({ success: true, data: screenshot });
  } catch (error) {
    console.error("❌ [Server] Upload failed:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

// 🚀 ONLY ONE GET ROUTE NOW
// GET /api/captures/:employeeId
// Fetches ONLY the visual history (screenshots) for the grid view
router.get("/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    const captures = await prisma.screenshot.findMany({
      where: { employeeId: employeeId },
      orderBy: { createdAt: "desc" },
      take: 60,
    });

    res.json({ success: true, data: captures });
  } catch (error) {
    console.error("❌ [Server] Fetch error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
