import { Router } from "express"
import { createBOGPayment } from "../../handlers/payments/createBOGPayment"

const bogPaymentsRouter = Router()

 
bogPaymentsRouter.post("/payments/bog/create", createBOGPayment)


// bogPaymentsRouter.post("/payments/bog-callback", handleBOGCallback)


// bogPaymentsRouter.get("/payments/bog/status/:order_id", getBOGPaymentStatus)

export default bogPaymentsRouter
