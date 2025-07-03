import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import pool from "../../config/sql";
import { sendBookingConfirmationEmail } from "../../mail/purchase";

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
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

// Middleware to capture raw body as string for signature verification
export const rawBodyMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let data = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => {
    data += chunk;
  });
  req.on("end", () => {
    (req as any).rawBody = data;
    next();
  });
};

export const handleBOGCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const rawBody = (req as any).rawBody as string;
    const signature = req.headers["callback-signature"] as string;

    if (signature) {
      const isValidSignature = verifyBOGSignature(rawBody, signature);
      if (!isValidSignature) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
    } else {
      // Signature header missing - you may want to reject or allow based on your security policy
      res.status(400).json({ error: "Missing signature header" });
      return;
    }

    // Parse JSON after successful signature verification
    const callbackData = JSON.parse(rawBody);

    if (!callbackData.event || callbackData.event !== "order_payment") {
      res.status(400).json({ error: "Invalid event type" });
      return;
    }

    if (!callbackData.body || !callbackData.body.order_id) {
      res.status(400).json({ error: "Missing order_id" });
      return;
    }

    const orderData = callbackData.body;

    switch (orderData.order_status.key) {
      case "completed":
        await handlePaymentSuccess(orderData);
        break;
      case "rejected":
        await handlePaymentFailure(orderData);
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
      status: orderData.order_status.key,
    });
  } catch (error) {
    console.error("Callback processing error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

// Your existing handlers below remain unchanged:

async function handlePaymentSuccess(orderData: any) {
  try {
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
      orderData.purchase_units.transfer_amount,
      JSON.stringify(orderData),
      orderData.order_id,
    ];

    const { rows } = await pool.query(updateQuery, values);

    if (rows.length === 0) {
      console.error("❌ Payment record not found in database");
    }
  } catch (error) {
    console.error("❌ Database error during payment success:", error);
  }
}

async function handlePaymentFailure(orderData: any) {
  try {
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

    if (rows.length > 0) {
      console.log("❌ Payment failure recorded in database");

      // Extract user info from the failed order record if available
      const failedOrder = rows[0];

      // Ideally, get real user info from failedOrder instead of hardcoded values:
      const firstname = failedOrder.customer_first_name || "Lado";
      const lastname = failedOrder.customer_last_name || "Lado";
      const email = failedOrder.customer_email || "lado.asambadze1@gmail.com";

      await sendBookingConfirmationEmail({
        firstName: firstname,
        lastName: lastname,
        email: email,
      });
    }
  } catch (error) {
    console.error("❌ Database error during payment failure:", error);
  }
}

async function handlePaymentRefund(orderData: any) {
  try {
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
      orderData.purchase_units.refund_amount,
      JSON.stringify(orderData),
      orderData.order_id,
    ];

    await pool.query(updateQuery, values);
  } catch (error) {
    console.error("❌ Database error during refund:", error);
  }
}

async function handleOtherStatus(orderData: any) {
  try {
    const updateQuery = `
      UPDATE payment_orders 
      SET 
        status = $1,
        callback_data = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE bog_order_id = $3 OR external_order_id = $3;
    `;

    const values = [
      orderData.order_status.key,
      JSON.stringify(orderData),
      orderData.order_id,
    ];

    await pool.query(updateQuery, values);
  } catch (error) {
    console.error("❌ Database error during status update:", error);
  }
}
