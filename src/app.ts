import express, { Application } from "express";
import cors from "express"; // ensure you run: npm install cors
import authRoutes from "./routes/auth.routes";
import statsRoutes from "./routes/stats.routes";

const app: Application = express();

// Middleware
app.use(express.json());
// Allow Next.js dashboard to fetch data
app.use(require("cors")({ origin: "*" }));

// HTTP REST Routes
app.use("/api/auth", authRoutes);
app.use("/api/stats", statsRoutes);

// Basic Health Check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "HTTP API is running seamlessly" });
});

export default app;
