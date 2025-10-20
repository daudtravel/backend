import type { Request, Response } from "express";
import pool from "../../config/sql";
import { sendPaymentSuccessEmail } from "../../mail/tours/tours-success-pay-email";
import { verifyBOGSignature } from "../payments/payments";

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
      console.error("❌ Invalid BOG callback signature!");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    let callbackData: any;
    try {
      callbackData = JSON.parse(rawBody);
    } catch {
      console.error("❌ Invalid JSON in callback data");
      res.status(400).json({ error: "Invalid JSON in callback data" });
      return;
    }

    console.log("📨 BOG Callback received:", {
      event: callbackData.event,
      order_id: callbackData.body?.order_id,
      status: callbackData.body?.order_status?.key,
      timestamp: callbackData.zoned_request_time,
    });

    if (callbackData.event !== "order_payment") {
      console.error("❌ Invalid event type:", callbackData.event);
      res.status(400).json({ error: "Invalid event type" });
      return;
    }

    const orderData = callbackData.body;
    if (!orderData?.order_id) {
      console.error("❌ Missing order_id in callback");
      res.status(400).json({ error: "Missing order_id" });
      return;
    }

    switch (orderData.order_status?.key) {
      case "completed":
        await handlePaymentSuccess(orderData);
        break;
      case "rejected":
        await handlePaymentFailure(orderData);
        break;
      case "created":
      case "processing":
        console.log(
          `ℹ️  Payment ${orderData.order_status.key}: ${orderData.order_id}`
        );
        await handleOtherStatus(orderData);
        break;
      default:
        console.warn(`⚠️  Unknown status: ${orderData.order_status?.key}`);
        await handleOtherStatus(orderData);
    }

    res.status(200).json({
      success: true,
      message: "Callback processed successfully",
      order_id: orderData.order_id,
      status: orderData.order_status?.key,
      processed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ ERROR processing BOG callback:", error);
    console.error("Request body:", JSON.stringify(req.body, null, 2));

    res.status(200).json({
      success: false,
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
};

async function handlePaymentSuccess(orderData: any) {
  try {
    console.log(`✅ Processing successful payment: ${orderData.order_id}`);

    const updateQuery = `
      UPDATE payment_orders 
      SET 
        status = 'completed',
        transaction_id = $1,
        payment_method = $2,
        amount_paid = $3,
        payment_response_code = $4,
        paid_at = CURRENT_TIMESTAMP,
        callback_data = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE bog_order_id = $6 OR external_order_id = $6
      RETURNING *;
    `;

    const values = [
      orderData.payment_detail?.transaction_id || null,
      orderData.payment_detail?.transfer_method?.key || "card",
      parseFloat(
        orderData.purchase_units?.transfer_amount ||
          orderData.purchase_units?.request_amount ||
          "0"
      ),
      orderData.payment_detail?.code || "100",
      JSON.stringify(orderData),
      orderData.order_id,
    ];

    const { rows } = await pool.query(updateQuery, values);

    if (rows.length === 0) {
      console.warn(
        `⚠️ No order found in database for order_id: ${orderData.order_id}`
      );
      return;
    }

    const successOrder = rows[0];

    console.log(`✅ Payment completed for order ${successOrder.id}:`, {
      customer: successOrder.customer_email,
      amount: successOrder.amount_paid,
      transaction_id: successOrder.transaction_id,
    });

    if (!successOrder.customer_email) {
      console.warn("⚠️ No customer email found, skipping success email");
      return;
    }

    await sendPaymentSuccessEmail({
      firstName: successOrder.customer_first_name || "Customer",
      lastName: successOrder.customer_last_name || "",
      email: successOrder.customer_email,
      detailsLink: `https://daudtravel.com/tours/order/${successOrder.id}`,
    });

    console.log(`📧 Success email sent to: ${successOrder.customer_email}`);
  } catch (error) {
    console.error("❌ Error in handlePaymentSuccess:", error);
    throw error;
  }
}

async function handlePaymentFailure(orderData: any) {
  try {
    console.log(`❌ Processing failed payment: ${orderData.order_id}`);

    const failureReason =
      orderData.payment_detail?.code_description ||
      orderData.reject_reason ||
      "Payment failed - unknown reason";

    const updateQuery = `
      UPDATE payment_orders 
      SET 
        status = 'failed',
        rejection_reason = $1,
        payment_response_code = $2,
        failed_at = CURRENT_TIMESTAMP,
        callback_data = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE bog_order_id = $4 OR external_order_id = $4
      RETURNING *;
    `;

    const values = [
      failureReason,
      orderData.payment_detail?.code || null,
      JSON.stringify(orderData),
      orderData.order_id,
    ];

    const { rows } = await pool.query(updateQuery, values);

    if (rows.length === 0) {
      console.warn(
        `⚠️ No order found in database for order_id: ${orderData.order_id}`
      );
      return;
    }

    const failedOrder = rows[0];

    console.log(`❌ Payment failed for order ${failedOrder.id}:`, {
      customer: failedOrder.customer_email,
      reason: failureReason,
      code: orderData.payment_detail?.code,
    });

    if (!failedOrder.customer_email) {
      console.warn("⚠️ No customer email found, skipping failure email");
      return;
    }

    // TODO: Implement sendPaymentFailureEmail if needed
    // await sendPaymentFailureEmail({
    //   firstName: failedOrder.customer_first_name || "Customer",
    //   lastName: failedOrder.customer_last_name || "",
    //   email: failedOrder.customer_email,
    //   reason: failureReason,
    // });
  } catch (error) {
    console.error("❌ Error in handlePaymentFailure:", error);
    throw error;
  }
}

async function handleOtherStatus(orderData: any) {
  try {
    const statusKey = orderData.order_status?.key || "unknown";

    console.log(`ℹ️  Processing status '${statusKey}': ${orderData.order_id}`);

    const updateQuery = `
      UPDATE payment_orders 
      SET 
        status = $1,
        callback_data = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE bog_order_id = $3 OR external_order_id = $3
      RETURNING *;
    `;

    const values = [statusKey, JSON.stringify(orderData), orderData.order_id];

    const { rows } = await pool.query(updateQuery, values);

    if (rows.length > 0) {
      console.log(
        `✅ Status updated to '${statusKey}' for order ${rows[0].id}`
      );
    } else {
      console.warn(
        `⚠️ No order found in database for order_id: ${orderData.order_id}`
      );
    }
  } catch (error) {
    console.error("❌ Error in handleOtherStatus:", error);
    throw error;
  }
}
