import { Router } from "express";
import {  createTransfer, getAllTransfers, getTransferById, updateTransfer  } from "../../handlers/transfers";
 
const transfersRouter = Router();
 

transfersRouter.post("/create_transfers",  createTransfer);
transfersRouter.get("/transfers",  getAllTransfers);
transfersRouter.get("/transfers/:id",  getTransferById);
transfersRouter.put("/update_transfers",  updateTransfer);
transfersRouter.delete("/transfers/:id",  getTransferById);

 



export default transfersRouter;