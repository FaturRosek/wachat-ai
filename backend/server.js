require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const apiRoutes = require("./src/routes");
const { errorHandler, notFound } = require("./src/middleware/errorHandler");
const { testConnection } = require("./src/config/database");
const { testRedisConnection } = require("./src/config/redis");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",") : "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use("/api", apiRoutes);

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
  const server = app.listen(PORT, async () => {
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
