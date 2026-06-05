// src/server.ts (Leave this exactly as is!)
import { createServer } from "http";
import app from "./app";
import { initializeSockets } from "./sockets";
import { ENV } from "./config/env";
import { logger } from "./utils/logger";

// 1. Create the native HTTP server using the Express configuration
const httpServer = createServer(app);

// 2. Attach Socket.io to the server for real-time WebSocket traffic
const io = initializeSockets(httpServer);

// 3. Start the engine
httpServer.listen(ENV.PORT, () => {
  logger.info(`🚀 HTTP Server running on port ${ENV.PORT}`);
  logger.info(`🔌 WebSocket Server initialized and waiting for connections`);
});
