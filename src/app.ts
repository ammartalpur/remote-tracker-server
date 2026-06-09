import express, { Application } from "express";
import cors from "express"; // ensure you run: npm install cors
import authRoutes from "./routes/auth.routes";
import statsRoutes from "./routes/stats.routes";
import capturesRouter from './routes/history'


const app: Application = express();

// Middleware

app.use(express.json({ limit: "15mb" }));
// Allow Next.js dashboard to fetch data
app.use(require("cors")({ origin: "*" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// HTTP REST Routes
app.use("/api/auth", authRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/captures", capturesRouter);

// Basic Health Check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "HTTP API is running seamlessly" });
});

export default app;
