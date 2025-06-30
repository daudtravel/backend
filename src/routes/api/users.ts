import { Router } from "express";

import verifyToken from "../../middlewares/auth-middleware";
import {
  createAndVerify,
  sendVerificationCode,
  signin,
} from "../../controllers/authController";

const usersRouter = Router();

usersRouter.post("/send_code", sendVerificationCode);
usersRouter.post("/signup", createAndVerify);
usersRouter.post("/signin", signin);
usersRouter.post("/auth/status", verifyToken);

export default usersRouter;
