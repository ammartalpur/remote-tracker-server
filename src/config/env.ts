import dotenv from "dotenv";
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 4000,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || "112233",
  DASHBOARD_ORIGIN: process.env.DASHBOARD_ORIGIN || "http://localhost:3000",
};
