import { Router } from "express";
import {
  createTransfer,
  deleteTransfer,
  getAllTransfers,
  getTransferById,
  updateTransfer,
} from "../../controllers/transfersController";
import verifyToken from "../../middlewares/auth-middleware";

const transfersRouter = Router();

transfersRouter.post("/create_transfers", verifyToken, createTransfer);
transfersRouter.get("/transfers", getAllTransfers);
transfersRouter.get("/transfers/:id", getTransferById);
transfersRouter.put("/update_transfers/:id", verifyToken, updateTransfer);
transfersRouter.delete("/delete_transfer/:id", verifyToken, deleteTransfer);

export default transfersRouter;
