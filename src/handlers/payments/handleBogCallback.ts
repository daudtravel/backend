import type { Request, Response } from "express";
import crypto from "crypto";
import pool from "../../config/sql";
import { sendPaymentSuccessEmail } from "../../mail/success";
import { sendPaymentFailureEmail } from "../../mail/failure";
import { sendPaymentRefundEmail } from "../../mail/refund";

const BOG_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu4RUyAw3+CdkS3ZNILQh
zHI9Hemo+vKB9U2BSabppkKjzjjkf+0Sm76hSMiu/HFtYhqWOESryoCDJoqffY0Q
1VNt25aTxbj068QNUtnxQ7KQVLA+pG0smf+EBWlS1vBEAFbIas9d8c9b9sSEkTrr
TYQ90WIM8bGB6S/KLVoT1a7SnzabjoLc5Qf/SLDG5fu8dH8zckyeYKdRKSBJKvhx
tcBuHV4f7qsynQT+f2UYbESX/TLHwT5qFWZDHZ0YUOUIvb8n7JujVSGZO9/+ll/g
4ZIWhC1MlJgPObDwRkRd8NFOopgxMcMsDIZIoLbWKhHVq67hdbwpAq9K9WMmEhPn
PwIDAQAB
-----END PUBLIC KEY-----`;

function verifyBOGSignature(body: string, signature: string): boolean {
  try {
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(body, "utf8");
    return verifier.verify(BOG_PUBLIC_KEY, signature, "base64");
  } catch {
    return false;
  }
}

export const handleBOGCallback = async (
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
        await handlePaymentFailure(orderData);
        break;
      case "rejected":
        await handlePaymentSuccess(orderData);
        break;
      case "refunded":
        await handlePaymentRefund(orderData);
        break;
      default:
        await handleOtherStatus(orderData);
    }

    res.status(200).json({
      success: true,
      message: "Callback processed successfully",
      order_id: orderData.order_id,
      status: orderData.order_status?.key,
      processed_at: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({
      success: false,
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
};

async function handlePaymentSuccess(orderData: any) {
  const updateQuery = `
    UPDATE payment_orders 
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
  if (rows.length === 0) return;

  const successOrder = rows[0];
  if (!successOrder.customer_email) return;

  await sendPaymentSuccessEmail({
    firstName: successOrder.customer_first_name || "Customer",
    lastName: successOrder.customer_last_name || "",
    email: successOrder.customer_email,
    detailsLink: `https://daudtravel.com/order/${orderData.order_id}`,
  });
}

async function handlePaymentFailure(orderData: any) {
  const updateQuery = `
    UPDATE payment_orders 
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
  if (rows.length === 0) return;

  const failedOrder = rows[0];
  if (!failedOrder.customer_email) return;

  await sendPaymentFailureEmail({
    firstName: failedOrder.customer_first_name || "Customer",
    lastName: failedOrder.customer_last_name || "",
    email: failedOrder.customer_email,
    rejectionReason: orderData.reject_reason,
  });
}

async function handlePaymentRefund(orderData: any) {
  const updateQuery = `
    UPDATE payment_orders 
    SET 
      status = 'refunded',
      refunded_amount = $1,
      refunded_at = CURRENT_TIMESTAMP,
      callback_data = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE bog_order_id = $3 OR external_order_id = $3
    RETURNING *;
  `;

  const values = [
    orderData.purchase_units?.refund_amount,
    JSON.stringify(orderData),
    orderData.order_id,
  ];

  const { rows } = await pool.query(updateQuery, values);
  if (rows.length === 0) return;

  const refundOrder = rows[0];
  if (!refundOrder.customer_email) return;

  await sendPaymentRefundEmail({
    firstName: refundOrder.customer_first_name || "Customer",
    lastName: refundOrder.customer_last_name || "",
    email: refundOrder.customer_email,
  });
}

async function handleOtherStatus(orderData: any) {
  const updateQuery = `
    UPDATE payment_orders 
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

  await pool.query(updateQuery, values);
}
