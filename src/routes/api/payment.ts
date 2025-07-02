import { Router } from "express";
import { getBOGPaymentStatus } from "../../handlers/payments/handleBogPaymentStatus";
import { handleBOGCallbackImproved } from "../../handlers/payments/handleBogCallback";
import { getPaymentOrder } from "../../handlers/payments/getPaymentOrders";
import { handleBOGPayment } from "../../handlers/payments/handleBOGPayment";

const bogPaymentsRouter = Router();

bogPaymentsRouter.post("/payments/bog/create", handleBOGPayment);
bogPaymentsRouter.post("/payments/bog/callback", handleBOGCallbackImproved);
bogPaymentsRouter.get("/payments/bog/status/:order_id", getBOGPaymentStatus);
bogPaymentsRouter.get("/orders", getPaymentOrder);

export default bogPaymentsRouter;
