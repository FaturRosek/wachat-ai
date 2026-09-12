require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const http = require("http");
const apiRoutes = require("./src/routes");
const { errorHandler, notFound } = require("./src/middleware/errorHandler");
const { testConnection } = require("./src/config/database");
const { testRedisConnection } = require("./src/config/redis");
const socketService = require("./src/services/socketService");

const { globalLimiter } = require("./src/middleware/rateLimiter");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

socketService.init(server);

app.use(helmet());

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ limit: "5mb", extended: true }));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use("/api", globalLimiter, apiRoutes);

app.get("/", (req, res) => {
  res.json({
    name: "WaChat AI Backend API",
    version: "1.0.0",
    status: "online",
    documentation: "/api/health",
  });
});

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  server.listen(PORT, async () => {
    console.log(`WaChat AI Backend running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

    await testConnection();
    await testRedisConnection();
    const whatsappService = require("./src/services/whatsappService");
    await whatsappService.restoreAllSavedSessions();
  });

  const handleShutdown = (signal) => {
    console.log(`\n[Server] ${signal} signal received: closing HTTP server...`);
    server.close(() => {
      console.log("[Server] HTTP server closed gracefully.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
};

if (require.main === module) {
  startServer();
}

module.exports = app;
