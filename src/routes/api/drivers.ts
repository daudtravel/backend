import { Router } from "express";
import {
  addDriver,
  deleteDriver,
  getAllDrivers,
} from "../../controllers/driversController";
import verifyToken from "../../middlewares/auth-middleware";

const driversRouter = Router();

driversRouter.post("/add_driver", verifyToken, addDriver);
driversRouter.get("/drivers", getAllDrivers);
driversRouter.delete("/drivers/:id", verifyToken, deleteDriver);

export default driversRouter;
