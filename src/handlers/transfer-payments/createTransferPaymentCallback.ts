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
      case "rejected":
        await handleTransferPaymentSuccess(orderData);
        break;
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
    transferName: successOrder.transfer_name,
    transferDate: successOrder.transfer_date,
    transferTime: successOrder.transfer_time,
    startLocation: successOrder.start_location,
    endLocation: successOrder.end_location,
    vehicleType: successOrder.vehicle_type,
    passengerCount: successOrder.passenger_count,
    paidAmount: successOrder.paid_amount,
    detailsLink: `https://daudtravel.com/transfer-order/${successOrder.id}`,
  });
}

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
