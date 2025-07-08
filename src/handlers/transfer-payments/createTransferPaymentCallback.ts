import type { Request, Response } from "express";
import pool from "../../config/sql";
import { sendTransferPaymentSuccessEmail } from "../../mail/transfer/transfer-success-email";
import { verifyBOGSignature } from "../payments/payments";

export const handleTransferBOGCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    let rawBody: string;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString("utf8");
    } else if (typeof req.body === "string") {
      rawBody = req.body;
    } else {
      rawBody = JSON.stringify(req.body);
    }

    const signature = req.headers["callback-signature"] as string;
    if (!signature || !verifyBOGSignature(rawBody, signature)) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    let callbackData: any;
    try {
      callbackData = JSON.parse(rawBody);
    } catch {
      res.status(400).json({ error: "Invalid JSON in callback data" });
      return;
    }

    if (callbackData.event !== "order_payment") {
      res.status(400).json({ error: "Invalid event type" });
      return;
    }

    const orderData = callbackData.body;
    if (!orderData?.order_id) {
      res.status(400).json({ error: "Missing order_id" });
      return;
    }

    switch (orderData.order_status?.key) {
      case "completed":
        await handleTransferPaymentSuccess(orderData);
        break;
      case "rejected":
        await handleTransferPaymentSuccess(orderData);
        break;
      // case "refunded":
      //   await handleTransferPaymentRefund(orderData);
      //   break;
      default:
        await handleTransferOtherStatus(orderData);
    }

    res.status(200).json({
      success: true,
      message: "Transfer callback processed successfully",
      order_id: orderData.order_id,
      status: orderData.order_status?.key,
      processed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Transfer BOG Callback Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
};

async function handleTransferPaymentSuccess(orderData: any) {
  const updateQuery = `
    UPDATE transfer_payment_orders 
    SET 
      status = 'completed',
      transaction_id = $1,
      payment_method = $2,
      paid_amount = $3,
      paid_at = CURRENT_TIMESTAMP,
      callback_data = $4,
      updated_at = CURRENT_TIMESTAMP
    WHERE bog_order_id = $5 OR external_order_id = $5
    RETURNING *;
  `;

  const values = [
    orderData.payment_detail?.transaction_id,
    orderData.payment_detail?.transfer_method?.key,
    orderData.purchase_units?.request_amount,
    JSON.stringify(orderData),
    orderData.order_id,
  ];

  const { rows } = await pool.query(updateQuery, values);
  if (rows.length === 0) {
    console.warn(`No transfer order found for order_id: ${orderData.order_id}`);
    return;
  }

  const successOrder = rows[0];
  if (!successOrder.customer_email) {
    console.warn(
      `No customer email found for transfer order: ${successOrder.id}`
    );
    return;
  }

  await sendTransferPaymentSuccessEmail({
    firstName: successOrder.customer_first_name || "Customer",
    lastName: successOrder.customer_last_name || "",
    email: successOrder.customer_email,
    detailsLink: `https://daudtravel.com/transfer/order/${successOrder.id}`,
  });
}

async function handleTransferPaymentFailure(orderData: any) {
  const updateQuery = `
    UPDATE transfer_payment_orders 
    SET 
      status = 'failed',
      rejection_reason = $1,
      failed_at = CURRENT_TIMESTAMP,
      callback_data = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE bog_order_id = $3 OR external_order_id = $3
    RETURNING *;
  `;

  const values = [
    orderData.reject_reason,
    JSON.stringify(orderData),
    orderData.order_id,
  ];

  const { rows } = await pool.query(updateQuery, values);
  if (rows.length === 0) {
    console.warn(
      `No transfer order found for failure update: ${orderData.order_id}`
    );
    return;
  }

  const failedOrder = rows[0];
  if (!failedOrder.customer_email) {
    console.warn(
      `No customer email found for failed transfer order: ${failedOrder.id}`
    );
    return;
  }

  // await sendTransferPaymentFailureEmail({
  //   firstName: failedOrder.customer_first_name || "Customer",
  //   lastName: failedOrder.customer_last_name || "",
  //   email: failedOrder.customer_email,
  //   transferName: failedOrder.transfer_name,
  //   transferDate: failedOrder.transfer_date,
  //   transferTime: failedOrder.transfer_time,
  //   startLocation: failedOrder.start_location,
  //   endLocation: failedOrder.end_location,
  //   vehicleType: failedOrder.vehicle_type,
  //   rejectionReason: orderData.reject_reason,
  // });
}

// async function handleTransferPaymentRefund(orderData: any) {
//   const updateQuery = `
//     UPDATE transfer_payment_orders
//     SET
//       status = 'refunded',
//       refunded_amount = $1,
//       refunded_at = CURRENT_TIMESTAMP,
//       callback_data = $2,
//       updated_at = CURRENT_TIMESTAMP
//     WHERE bog_order_id = $3 OR external_order_id = $3
//     RETURNING *;
//   `;

//   const values = [
//     orderData.purchase_units?.refund_amount,
//     JSON.stringify(orderData),
//     orderData.order_id,
//   ];

//   const { rows } = await pool.query(updateQuery, values);
//   if (rows.length === 0) {
//     console.warn(
//       `No transfer order found for refund update: ${orderData.order_id}`
//     );
//     return;
//   }

//   const refundOrder = rows[0];
//   if (!refundOrder.customer_email) {
//     console.warn(
//       `No customer email found for refunded transfer order: ${refundOrder.id}`
//     );
//     return;
//   }

//   await sendTransferPaymentRefundEmail({
//     firstName: refundOrder.customer_first_name || "Customer",
//     lastName: refundOrder.customer_last_name || "",
//     email: refundOrder.customer_email,
//     transferName: refundOrder.transfer_name,
//     transferDate: refundOrder.transfer_date,
//     transferTime: refundOrder.transfer_time,
//     startLocation: refundOrder.start_location,
//     endLocation: refundOrder.end_location,
//     vehicleType: refundOrder.vehicle_type,
//     refundedAmount: refundOrder.refunded_amount,
//   });
// }

async function handleTransferOtherStatus(orderData: any) {
  const updateQuery = `
    UPDATE transfer_payment_orders 
    SET 
      status = $1,
      callback_data = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE bog_order_id = $3 OR external_order_id = $3
    RETURNING *;
  `;

  const values = [
    orderData.order_status?.key,
    JSON.stringify(orderData),
    orderData.order_id,
  ];

  const { rows } = await pool.query(updateQuery, values);
  if (rows.length === 0) {
    console.warn(
      `No transfer order found for status update: ${orderData.order_id}`
    );
    return;
  }
}
