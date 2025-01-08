import express from "express";
import dotenv from 'dotenv';
import router from "./routes";
import cors from "cors"
import swaggerMiddleware from "./middlewares/swagger-middleware";
import corsMiddleware from "./middlewares/cors-middleware";
import { initDatabase } from "./database/db.init";
import path from 'path';

dotenv.config();
const app = express();

app.use(cors());
app.use(corsMiddleware) 
app.use(express.json({ limit: '50mb' }));
app.use("/api", router);
app.use("/api", ...swaggerMiddleware)
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
    console.log(`Running on ${PORT}`);
  });
})();




export default app;