import { Router } from "express";
import {  createTransfer, deleteTransfer, getAllTransfers, getTransferById, updateTransfer  } from "../../handlers/transfers";
 
const transfersRouter = Router();
 

transfersRouter.post("/create_transfers",  createTransfer);
transfersRouter.get("/transfers",  getAllTransfers);
transfersRouter.get("/transfers/:id",  getTransferById);
transfersRouter.put("/update_transfers/:id",  updateTransfer);
transfersRouter.delete("/delete_transfer/:id",  deleteTransfer);

 



export default transfersRouter;