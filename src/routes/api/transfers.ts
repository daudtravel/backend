import { Router } from "express";
import {  getAllTransfers  } from "../../handlers/transfers";
 
const transfersRouter = Router();
 

// transfersRouter.post("/create_transfers",  createTransfer);
transfersRouter.get("/all_transfers",  getAllTransfers);
// transfersRouter.put("/update_transfer",  updateTransfer);
// transfersRouter.delete("/transfer/:id",  deleteTransfer);



export default transfersRouter;