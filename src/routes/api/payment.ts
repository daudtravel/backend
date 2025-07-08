import { Router } from "express";
import { getBOGPaymentStatus } from "../../handlers/payments/handleBogPaymentStatus";
import { getPaymentOrder } from "../../handlers/payments/getPaymentOrders";
import { handleBOGPayment } from "../../handlers/payments/handleBOGPayment";
import { handleBOGCallback } from "../../handlers/payments/handleBogCallback";
import { getPaymentOrderById } from "../../handlers/payments/getPaymentByOrder";
import verifyToken from "../../middlewares/auth-middleware";
import { deleteFailedOrders } from "../../handlers/payments/paymentCleanUp";

const bogPaymentsRouter = Router();

bogPaymentsRouter.post("/payments/bog/create", handleBOGPayment);
bogPaymentsRouter.post("/payments/bog/callback", handleBOGCallback);
bogPaymentsRouter.get("/payments/bog/status/:order_id", getBOGPaymentStatus);
bogPaymentsRouter.get("/orders", verifyToken, getPaymentOrder);
bogPaymentsRouter.get("/orders/:id", getPaymentOrderById);
bogPaymentsRouter.delete("/orders/failed", verifyToken, deleteFailedOrders);

export default bogPaymentsRouter;
