import express from "express";
import dotenv from 'dotenv';
import router from "./routes";
import cookieParser from "cookie-parser";
import session from "express-session"
import passport from "passport"
import cors from "cors"
import "./strategies/local-strategy"
import swaggerMiddleware from "./middlewares/swagger-middleware";


dotenv.config();
const app = express();
app.use(cors({
  origin: [
    "https://daudtravel.com",
    "http://localhost:3000"
  ],
  credentials: true
}));

app.use(express.json())
app.use(cookieParser("secret"))
app.use(session({
  secret: "secret",
  saveUninitialized: false,
  resave: false,
  cookie: {
    maxAge: 60000,
  }
}))



app.use(passport.initialize())
app.use(passport.session())
app.use(router);
app.use("/api", ...swaggerMiddleware);


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Running on ${PORT}`);
});

export default app;