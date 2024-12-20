import { Router } from "express";
import { sendVerificationCode, createAndVerify, signin } from "../../handlers/users";
import verifyToken from "../../middlewares/auth-middleware";



const usersRouter = Router();


usersRouter.post("/send_code", sendVerificationCode);
usersRouter.post("/signup", createAndVerify);
usersRouter.post("/signin",  signin);
usersRouter.post("/auth/status", verifyToken)
 

export default usersRouter;