import express from "express";
import dotenv from "dotenv";
import router from "./routes";
import cors from "cors";
import { initDatabase } from "./database/db.init";
import path from "path";
import pool from "./config/sql";
import { sendPaymentFailureEmail } from "./mail/failure";

dotenv.config();

const app = express();

const corsOptions = {
  origin: [
    "https://daudtravel.com",
    "https://www.daudtravel.com",
    "http://localhost:3000",
    "http://localhost:3001",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  exposedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(
  "/api/payments/bog/callback",
  express.raw({ type: "application/json" })
);

app.use(
  express.json({
    limit: "50mb",
    verify: (req, res, buf) => {
      // Only set rawBody for non-callback routes
      if (!req.url?.includes("/payments/bog/callback")) {
        (req as any).rawBody = buf.toString();
      }
    },
  })
);

app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/api", router);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(express.static("./src/public"));

const PORT = process.env.PORT || 3001;

const gracefulShutdown = async () => {
  try {
    await pool.end();
  } catch (error) {
    console.error("Error closing database connections:", error);
  }
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

const startServer = async (): Promise<void> => {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

 

startServer();

export default app;
