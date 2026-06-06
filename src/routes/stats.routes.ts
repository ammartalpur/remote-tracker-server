import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

const router = Router();
const prisma = new PrismaClient();

// Fetch all registered employees and their connected devices
router.get("/employees", async (req: Request, res: Response): Promise<any> => {
  try {
    const employees = await prisma.employee.findMany({
      include: {
        devices: {
          select: {
            id: true,
            hostname: true,
            os: true,
            macAddress: true,
            lastIp: true,
            location: true,
            isActive: true, // Let the frontend know if they were online during last check
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ success: true, data: employees });
  } catch (error) {
    logger.error("Failed to fetch employee stats", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
});

// GET /api/stats/employees/:id/history
// Fetches the historical sessions and activity logs for a specific employee
router.get('/employees/:id/history', async (req, res) => {
  try {
    const { id } = req.params;

    const history = await prisma.device.findFirst({
      where: { employeeId: id },
      include: {
        sessions: {
          orderBy: { startedAt: 'desc' }, // Newest sessions first
          include: {
            activities: {
              orderBy: { timestamp: 'desc' } // Newest app switches first
            }
          }
        }
      }
    });

    if (!history) {
      return res.status(404).json({ success: false, message: 'No history found' });
    }

    res.json({ success: true, data: history.sessions });
  } catch (error) {
    console.error('History Fetch Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
