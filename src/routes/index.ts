import { Router } from "express";
import usersRouter from "./api/users";
import toursRouter from "./api/tours";
import transfersRouter from "./api/transfers";


const router = Router();
router.use(usersRouter);
router.use(toursRouter);
router.use(transfersRouter);
 

export default router;