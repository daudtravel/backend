import { Router } from "express";
import { getBOGPaymentStatus } from "../../handlers/payments/handleBogPaymentStatus";
import { getPaymentOrder } from "../../handlers/payments/getPaymentOrders";
import { handleBOGPayment } from "../../handlers/payments/handleBOGPayment";
import { handleBOGCallback } from "../../handlers/payments/handleBogCallback";
import { getPaymentOrderById } from "../../handlers/payments/getPaymentByOrder";

const bogPaymentsRouter = Router();

bogPaymentsRouter.post("/payments/bog/create", handleBOGPayment);

// Note: No need for rawBodyMiddleware here since we're handling it in app.js
bogPaymentsRouter.post("/payments/bog/callback", handleBOGCallback);

bogPaymentsRouter.get("/payments/bog/status/:order_id", getBOGPaymentStatus);
bogPaymentsRouter.get("/orders", getPaymentOrder);
bogPaymentsRouter.get("/orders/:id", getPaymentOrderById);

export default bogPaymentsRouter;
