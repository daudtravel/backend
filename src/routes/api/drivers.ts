import { Router } from "express";
import { addDriver, deleteDriver, getAllDrivers } from "../../handlers/drivers";
 
 
const transfersRouter = Router();
 

transfersRouter.post("/add_driver",  addDriver);
transfersRouter.get("/drivers",  getAllDrivers);
transfersRouter.delete("/drivers/:id",  deleteDriver);
 

 



export default transfersRouter;