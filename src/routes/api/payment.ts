import { Router } from "express";
import { getBOGPaymentStatus } from "../../handlers/payments/handleBogPaymentStatus";

import { getPaymentOrder } from "../../handlers/payments/getPaymentOrders";
import { handleBOGPayment } from "../../handlers/payments/handleBOGPayment";
import {
  handleBOGCallback,
  rawBodyMiddleware,
} from "../../handlers/payments/handleBogCallback";
import { getPaymentOrderById } from "../../handlers/payments/getPaymentByOrder";

const bogPaymentsRouter = Router();

bogPaymentsRouter.post("/payments/bog/create", handleBOGPayment);

bogPaymentsRouter.post(
  "/payments/bog/callback",
  rawBodyMiddleware,
  handleBOGCallback
);
bogPaymentsRouter.get("/payments/bog/status/:order_id", getBOGPaymentStatus);
bogPaymentsRouter.get("/orders", getPaymentOrder);
bogPaymentsRouter.get("/orders/:id", getPaymentOrderById);


export default bogPaymentsRouter;
