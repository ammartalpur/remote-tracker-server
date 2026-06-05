// test-agent-telemetry.js
const { io } = require("socket.io-client");

const SERVER_URL = "http://localhost:4000";
const MOCK_MAC = "00:1A:2B:3C:4D:5E";

console.log("🚀 Starting Live Agent Simulation (Analytics Test)...");
console.log("👉 Dashboard: http://localhost:3000/dashboardn");

const brokerSocket = io(SERVER_URL, { auth: { type: "owner" } });
let unverifiedAgentSocket;
let verifiedAgentSocket;

// --- PHASE 1: HANDSHAKE ---
brokerSocket.on("connect", () => {
  unverifiedAgentSocket = io(SERVER_URL, { auth: { type: "agent" } });

  unverifiedAgentSocket.on("connect", () => {
    unverifiedAgentSocket.emit("agent:request_pairing", {
      hostname: "DESKTOP-AMMAR-DEV",
      os: "Windows 11",
      macAddress: MOCK_MAC,
      publicIp: "103.255.4.10",
    });
  });

  unverifiedAgentSocket.on("pairing_response", (response) => {
    if (response.success) {
      unverifiedAgentSocket.disconnect();
      brokerSocket.disconnect();
      runVerifiedAgent(response.deviceId, response.token);
    }
  });
});

brokerSocket.on("owner:pairing_popup", (data) => {
  if (data.macAddress === MOCK_MAC) {
    unverifiedAgentSocket.emit("agent:submit_otp", {
      macAddress: MOCK_MAC,
      otp: data.otp,
    });
  }
});

// --- PHASE 2: VERIFIED BACKGROUND AGENT ---
function runVerifiedAgent(deviceId, authToken) {
  console.log("=======================================================");
  console.log("🟢 Agent Connected! [CLOCK-IN TRIGGERED ON SERVER]");
  console.log("=======================================================\n");

  verifiedAgentSocket = io(SERVER_URL, {
    auth: { type: "agent", token: authToken, deviceId: deviceId },
  });

  verifiedAgentSocket.on("connect", () => {
    startAppTrackingLoop(deviceId);
    startCaptureListener(deviceId);
  });
}

// Simulates the user switching windows
function startAppTrackingLoop(deviceId) {
  const mockApps = [
    "Visual Studio Code - server.ts",
    "Google Chrome - Prisma Documentation",
    "Figma - Dashboard UI",
    "Slack - Engineering Team",
    "Spotify - Focus Mix",
  ];

  let currentIndex = 0;

  // Faster interval (3 seconds) so you don't have to wait long to build a timeline
  setInterval(() => {
    const currentAppName = mockApps[currentIndex];
    console.log(`📊 [Timeline Log] Switched to: "${currentAppName}"`);

    verifiedAgentSocket.emit("agent:update_app", {
      deviceId: deviceId,
      appName: currentAppName,
    });

    currentIndex = (currentIndex + 1) % mockApps.length;
  }, 3000);
}

function startCaptureListener(deviceId) {
  const mockBase64Image =
    "iVBORw0KGgoAAAANSUhEUgAAAZAAAADwCAYAAAA69gD2AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAAADhSTREFUeJzt1gENAAAAwqD3T20ON6AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsHMAm2sAAf6v3gIAAAAASUVORK5CYII=";

  verifiedAgentSocket.on("agent:capture_now", () => {
    console.log("📸 Sending screenshot back to dashboard...");
    verifiedAgentSocket.emit("agent:deliver_screenshot", {
      deviceId: deviceId,
      base64Image: mockBase64Image,
    });
  });
}

// Graceful shutdown to test clock-out
process.on("SIGINT", () => {
  console.log("\n🛑 Agent Disconnecting... [CLOCK-OUT TRIGGERED ON SERVER]");
  if (verifiedAgentSocket) verifiedAgentSocket.disconnect();

  setTimeout(() => {
    console.log(
      "✅ Session saved to database. Check your Dashboard History page!",
    );
    process.exit(0);
  }, 500);
});
