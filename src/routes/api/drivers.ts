import { Router } from "express";
import {
  addDriver,
  deleteDriver,
  getAllDrivers,
} from "../../controllers/driversController";

const driversRouter = Router();

driversRouter.post("/add_driver", addDriver);
driversRouter.get("/drivers", getAllDrivers);
driversRouter.delete("/drivers/:id", deleteDriver);

export default driversRouter;
