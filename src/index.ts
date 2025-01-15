import express from "express";
import dotenv from "dotenv";
import router from "./routes";
import cors from "cors";
import swaggerMiddleware from "./middlewares/swagger-middleware";
import { initDatabase } from "./database/db.init";
import path from "path";

dotenv.config();
const app = express();

const corsOptions = {
  origin: [
    'https://daudtravel.com', 
    'https://www.daudtravel.com', 
    'https://test.daudtravel.com',
    'http://localhost:4000',
    'http://localhost:3000',
    'http://localhost:3001' 
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],  // Added 'Accept'
  exposedHeaders: ['Content-Type', 'Authorization'],  // Added exposed headers
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400  
};


app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.raw({ limit: '50mb' }));
app.use((req, res, next) => {
  // Set timeout to 5 minutes for large uploads
  req.setTimeout(300000);
  res.setTimeout(300000);
  next();
});

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