import { Router } from "express";
import usersRouter from "./api/users";


const router = Router();
router.use(usersRouter);
 

export default router;