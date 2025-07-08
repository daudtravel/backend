import { Router } from "express";
import { getPaymentOrder } from "../../handlers/tour-payments/getToursPaymentOrders";
import { handleBOGPayment } from "../../handlers/tour-payments/createTourPayment";
import { handleBOGCallback } from "../../handlers/tour-payments/createTourPaymentCallback";
import { getPaymentOrderById } from "../../handlers/tour-payments/getTourPaymentOrderById";
import verifyToken from "../../middlewares/auth-middleware";
import { deleteFailedOrders } from "../../handlers/tour-payments/toursFailedPaymentCleanup";
import { getBOGReceiptStatus } from "../../handlers/payments/paymentStatus";

const bogPaymentsRouter = Router();

bogPaymentsRouter.post("/payments/bog/create", handleBOGPayment);
bogPaymentsRouter.post("/payments/bog/callback", handleBOGCallback);
bogPaymentsRouter.get("/payments/bog/status/:order_id", getBOGReceiptStatus);
bogPaymentsRouter.get("/orders", verifyToken, getPaymentOrder);
bogPaymentsRouter.get("/orders/:id", getPaymentOrderById);
bogPaymentsRouter.delete("/orders/failed", verifyToken, deleteFailedOrders);

export default bogPaymentsRouter;
