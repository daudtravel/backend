import { Router } from "express";
import usersRouter from "./api/users";
import toursRouter from "./api/tours";
import transfersRouter from "./api/transfers";
import driversRouter from "./api/drivers";
import faqRouter from "./api/faq";
import videosRouter from "./api/videos";


const router = Router();
router.use(usersRouter);
router.use(toursRouter);
router.use(transfersRouter);
router.use(driversRouter);
router.use(faqRouter);
router.use(videosRouter);
 

export default router;