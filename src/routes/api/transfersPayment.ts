import { Router } from "express";
import { getBOGPaymentStatus } from "../../handlers/tour-payments/tourPaymentStatus";
import { getPaymentOrder } from "../../handlers/tour-payments/getToursPaymentOrders";
import { handleBOGPayment } from "../../handlers/tour-payments/createTourPayment";
import { handleBOGCallback } from "../../handlers/tour-payments/createTourPaymentCallback";
import { getPaymentOrderById } from "../../handlers/tour-payments/getTourPaymentOrderById";
import verifyToken from "../../middlewares/auth-middleware";
import { deleteFailedOrders } from "../../handlers/tour-payments/toursFailedPaymentCleanup";
import { handleTransferBOGPayment } from "../../handlers/transfer-payments/createTransferPayment";
import { handleTransferBOGCallback } from "../../handlers/transfer-payments/createTransferPaymentCallback";
import { getBOGTransferStatus } from "../../handlers/transfer-payments/transfersPaymentStatus";
import { deleteFailedTransferOrders } from "../../handlers/transfer-payments/transfersFailedPaymentCleanup";

const bogTransfersPaymentRouter = Router();

bogTransfersPaymentRouter.post(
  "/payments/bog/create",
  handleTransferBOGPayment
);
bogTransfersPaymentRouter.post(
  "/payments/bog/callback",
  handleTransferBOGCallback
);
bogTransfersPaymentRouter.get(
  "/payments/bog/status/:order_id",
  getBOGTransferStatus
);
// bogTransfersPaymentRouter.get("/orders", verifyToken);
// bogTransfersPaymentRouter.get("/orders/:id", getPaymentOrderById);
bogTransfersPaymentRouter.delete(
  "/orders/failed",
  verifyToken,
  deleteFailedTransferOrders
);

export default bogTransfersPaymentRouter;
