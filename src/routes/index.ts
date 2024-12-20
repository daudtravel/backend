import { Router } from "express";
import usersRouter from "./api/users";
import toursRouter from "./api/tours";


const router = Router();
router.use(usersRouter);
router.use(toursRouter);
 

export default router;