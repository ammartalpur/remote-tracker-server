import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env";
import { logger } from "../utils/logger";

const router = Router();

router.post("/login", (req: Request, res: Response): any => {
  const { password } = req.body;

  // Set an ADMIN_PASSWORD in your .env, or fallback to 'admin123' for local testing
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

  if (password === ADMIN_PASSWORD) {
    // Mint a token for the owner that expires in 12 hours
    const token = jwt.sign({ role: "owner" }, ENV.JWT_SECRET, {
      expiresIn: "12h",
    });

    logger.info("Owner dashboard logged in successfully.");
    return res.json({ success: true, token });
  }

  logger.warn("Failed login attempt on dashboard.");
  return res
    .status(401)
    .json({ success: false, message: "Invalid credentials" });
});

export default router;
