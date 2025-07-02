import type { Request, Response } from "express";
import crypto from "crypto";
import pool from "../../config/sql";

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

export const handleBOGCallbackImproved = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log("🔔 BOG Callback received!");

    const rawBody = JSON.stringify(req.body);
    const signature = req.headers["callback-signature"] as string;

    if (signature) {
      const isValidSignature = verifyBOGSignature(rawBody, signature);
      if (!isValidSignature) {
        console.error("❌ Invalid BOG callback signature!");
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
    }

    const callbackData = req.body;

    if (!callbackData.event || callbackData.event !== "order_payment") {
      console.error("❌ Invalid callback event type:", callbackData.event);
      res.status(400).json({ error: "Invalid event type" });
      return;
    }

    if (!callbackData.body || !callbackData.body.order_id) {
      console.error("❌ Missing order_id in callback");
      res.status(400).json({ error: "Missing order_id" });
      return;
    }

    const orderData = callbackData.body;

    switch (orderData.order_status.key) {
      case "completed":
        await handlePaymentSuccessImproved(orderData);
        break;
      case "rejected":
        await handlePaymentFailureImproved(orderData);
        break;
      case "refunded":
        await handlePaymentRefundImproved(orderData);
        break;
      default:
        await handleOtherStatusImproved(orderData);
    }

    res.status(200).json({
      success: true,
      message: "Callback processed successfully",
      order_id: orderData.order_id,
      status: orderData.order_status.key,
    });
  } catch (error) {
    console.error("❌ Error processing BOG callback:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

async function handlePaymentSuccessImproved(orderData: any) {
  console.log("🎉 PAYMENT COMPLETED SUCCESSFULLY!");

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

    if (rows.length > 0) {
      const paymentRecord = rows[0];
      console.log("✅ Data has been saved in database");
      console.log(
        "👤 Customer:",
        paymentRecord.customer_first_name,
        paymentRecord.customer_last_name
      );
      console.log(
        "💰 Amount:",
        paymentRecord.paid_amount,
        paymentRecord.currency
      );
    } else {
      console.error("❌ Payment record not found in database");
    }
  } catch (error) {
    console.error("❌ Database error during payment success:", error);
  }
}

async function handlePaymentFailureImproved(orderData: any) {
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
    }
  } catch (error) {
    console.error("❌ Database error during payment failure:", error);
  }
}

async function handlePaymentRefundImproved(orderData: any) {
  console.log("💸 PAYMENT REFUNDED!");

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

async function handleOtherStatusImproved(orderData: any) {
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
