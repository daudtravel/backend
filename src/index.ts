import express from "express";
import dotenv from "dotenv";
import router from "./routes";
import cors from "cors";
import swaggerMiddleware from "./middlewares/swagger-middleware";
import { initDatabase } from "./database/db.init";
import path from "path";

dotenv.config();
const app = express();

// Define CORS options
const corsOptions = {
  origin: [
    'https://daudtravel.com', 
    'https://www.daudtravel.com', 
    'https://test.daudtravel.com', 
    'http://localhost:4000',
    'http://localhost:3000'  // Add your local development frontend URL here for local testing
  ],
  credentials: true,  // Allow cookies or credentials if needed
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,  // Ensures the OPTIONS response is automatically handled
  optionsSuccessStatus: 204  // Avoid 200 OK status on preflight requests
};

// Use CORS middleware with the defined options
app.use(cors(corsOptions));

app.use(express.json({ limit: '50mb' }));
app.use("/api", router);
app.use("/api", ...swaggerMiddleware);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

const PORT = process.env.PORT || 3001;

(async () => {
  try {
    await initDatabase();
    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database tables:', error);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Running on ${PORT}!`);
  });
})();

export default app;
