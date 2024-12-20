import express from "express";
import dotenv from 'dotenv';
import router from "./routes";

import cors from "cors"
import swaggerMiddleware from "./middlewares/swagger-middleware";
import corsMiddleware from "./middlewares/cors-middleware";


dotenv.config();
const app = express();

app.use(cors());
app.use(corsMiddleware)
app.use(express.json())
 
app.use("/api", router);
app.use("/api", ...swaggerMiddleware);


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Running on ${PORT}`);
});

export default app;