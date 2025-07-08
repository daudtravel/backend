import { Router } from "express";
import verifyToken from "../../middlewares/auth-middleware";
import { handleTransferBOGPayment } from "../../handlers/transfer-payments/createTransferPayment";
import { handleTransferBOGCallback } from "../../handlers/transfer-payments/createTransferPaymentCallback";

import { deleteFailedTransferOrders } from "../../handlers/transfer-payments/transfersFailedPaymentCleanup";
import { getAllTransferOrders } from "../../handlers/transfer-payments/getTransfersPaymentOrders";
import { getBOGReceiptStatus } from "../../handlers/payments/paymentStatus";
import { getTransferOrderById } from "../../handlers/transfer-payments/getTransferOrderById";

const bogTransfersPaymentRouter = Router();

bogTransfersPaymentRouter.post(
  "/payments/bog/transfer/create",
  handleTransferBOGPayment
);
bogTransfersPaymentRouter.post(
  "/payments/bog/callback/transfer",
  handleTransferBOGCallback
);
bogTransfersPaymentRouter.get(
  "/payments/bog/status/:order_id",
  getBOGReceiptStatus
);

bogTransfersPaymentRouter.delete(
  "/transfer/orders/failed",
  verifyToken,
  deleteFailedTransferOrders
);

bogTransfersPaymentRouter.get(
  "/transfer/orders",
  verifyToken,
  getAllTransferOrders
);

bogTransfersPaymentRouter.get(
  "/transfer/order/:id",

  getTransferOrderById
);
 

export default bogTransfersPaymentRouter;
