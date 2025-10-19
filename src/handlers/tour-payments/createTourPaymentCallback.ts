import type { Request, Response } from "express";
import pool from "../../config/sql";
import { sendPaymentSuccessEmail } from "../../mail/tours/tours-success-pay-email";
import { verifyBOGSignature } from "../payments/payments";

export const handleBOGCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Parse raw body
    let rawBody: string;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString("utf8");
    } else if (typeof req.body === "string") {
      rawBody = req.body;
    } else {
      rawBody = JSON.stringify(req.body);
    }

    console.log("BOG Callback received:", {
      timestamp: new Date().toISOString(),
      headers: req.headers,
      bodyLength: rawBody.length,
    });

    // Verify signature
    const signature = req.headers["callback-signature"] as string;
    if (!signature) {
      console.error("Missing callback signature");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    if (!verifyBOGSignature(rawBody, signature)) {
      console.error("Invalid BOG signature", {
        signature,
        bodyPreview: rawBody.substring(0, 100),
      });
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    console.log("Signature verified successfully");

    // Parse callback data
    let callbackData: any;
    try {
      callbackData = JSON.parse(rawBody);
    } catch (error) {
      console.error("Failed to parse callback JSON:", error);
      res.status(400).json({ error: "Invalid JSON in callback data" });
      return;
    }

    console.log("Parsed callback data:", {
      event: callbackData.event,
      order_id: callbackData.body?.order_id,
      status: callbackData.body?.order_status?.key,
    });

    // Validate event type
    if (callbackData.event !== "order_payment") {
      console.error("Invalid event type:", callbackData.event);
      res.status(400).json({ error: "Invalid event type" });
      return;
    }

    const orderData = callbackData.body;
    if (!orderData?.order_id) {
      console.error("Missing order_id in callback data");
      res.status(400).json({ error: "Missing order_id" });
      return;
    }

    // Process based on order status
    const orderStatus = orderData.order_status?.key;
    console.log(`Processing order ${orderData.order_id} with status: ${orderStatus}`);

    switch (orderStatus) {
      case "completed":
        await handlePaymentSuccess(orderData);
        console.log(`Payment success processed for order: ${orderData.order_id}`);
        break;
      case "rejected":
        await handlePaymentFailure(orderData);
        console.log(`Payment failure processed for order: ${orderData.order_id}`);
        break;
      // case "refunded":
      //   await handlePaymentRefund(orderData);
      //   console.log(`Payment refund processed for order: ${orderData.order_id}`);
      //   break;
      default:
        await handleOtherStatus(orderData);
        console.log(`Other status (${orderStatus}) processed for order: ${orderData.order_id}`);
    }

    res.status(200).json({
      success: true,
      message: "Callback processed successfully",
      order_id: orderData.order_id,
      status: orderStatus,
      processed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("BOG Callback Error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
};

async function handlePaymentSuccess(orderData: any) {
  try {
    console.log("Processing payment success:", {
      order_id: orderData.order_id,
      transaction_id: orderData.payment_detail?.transaction_id,
      amount: orderData.purchase_units?.request_amount,
      payment_method: orderData.payment_detail?.transfer_method?.key,
    });

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
    
    if (rows.length === 0) {
      console.warn(`Order not found in database: ${orderData.order_id}`);
      return;
    }

    const successOrder = rows[0];
    console.log("Order updated successfully:", {
      id: successOrder.id,
      status: successOrder.status,
      customer_email: successOrder.customer_email,
    });

    if (!successOrder.customer_email) {
      console.warn("No customer email found, skipping success email");
      return;
    }

    await sendPaymentSuccessEmail({
      firstName: successOrder.customer_first_name || "Customer",
      lastName: successOrder.customer_last_name || "",
      email: successOrder.customer_email,
      detailsLink: `https://daudtravel.com/tours/order/${successOrder.id}`,
    });

    console.log(`Success email sent to: ${successOrder.customer_email}`);
  } catch (error) {
    console.error("Error in handlePaymentSuccess:", {
      error: error instanceof Error ? error.message : "Unknown error",
      order_id: orderData.order_id,
    });
    throw error;
  }
}

async function handlePaymentFailure(orderData: any) {
  try {
    console.log("Processing payment failure:", {
      order_id: orderData.order_id,
      rejection_reason: orderData.reject_reason,
      timestamp: new Date().toISOString(),
    });

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
    
    if (rows.length === 0) {
      console.warn(`Order not found in database: ${orderData.order_id}`);
      return;
    }

    const failedOrder = rows[0];
    console.log("Order marked as failed:", {
      id: failedOrder.id,
      status: failedOrder.status,
      rejection_reason: failedOrder.rejection_reason,
      customer_email: failedOrder.customer_email,
    });

    if (!failedOrder.customer_email) {
      console.warn("No customer email found, skipping failure notification");
      return;
    }

    // TODO: Uncomment when sendPaymentFailureEmail is implemented
    // await sendPaymentFailureEmail({
    //   firstName: failedOrder.customer_first_name || "Customer",
    //   lastName: failedOrder.customer_last_name || "",
    //   email: failedOrder.customer_email,
    //   rejectionReason: orderData.reject_reason,
    // });
    // console.log(`Failure email sent to: ${failedOrder.customer_email}`);

    console.log(`Failure email NOT sent (function commented out) for: ${failedOrder.customer_email}`);
  } catch (error) {
    console.error("Error in handlePaymentFailure:", {
      error: error instanceof Error ? error.message : "Unknown error",
      order_id: orderData.order_id,
    });
    throw error;
  }
}

// async function handlePaymentRefund(orderData: any) {
//   try {
//     console.log("Processing payment refund:", {
//       order_id: orderData.order_id,
//       refund_amount: orderData.purchase_units?.refund_amount,
//       timestamp: new Date().toISOString(),
//     });

//     const updateQuery = `
//       UPDATE payment_orders
//       SET
//         status = 'refunded',
//         refunded_amount = $1,
//         refunded_at = CURRENT_TIMESTAMP,
//         callback_data = $2,
//         updated_at = CURRENT_TIMESTAMP
//       WHERE bog_order_id = $3 OR external_order_id = $3
//       RETURNING *;
//     `;

//     const values = [
//       orderData.purchase_units?.refund_amount,
//       JSON.stringify(orderData),
//       orderData.order_id,
//     ];

//     const { rows } = await pool.query(updateQuery, values);
    
//     if (rows.length === 0) {
//       console.warn(`Order not found in database: ${orderData.order_id}`);
//       return;
//     }

//     const refundOrder = rows[0];
//     console.log("Order marked as refunded:", {
//       id: refundOrder.id,
//       status: refundOrder.status,
//       refunded_amount: refundOrder.refunded_amount,
//       customer_email: refundOrder.customer_email,
//     });

//     if (!refundOrder.customer_email) {
//       console.warn("No customer email found, skipping refund notification");
//       return;
//     }

//     await sendPaymentRefundEmail({
//       firstName: refundOrder.customer_first_name || "Customer",
//       lastName: refundOrder.customer_last_name || "",
//       email: refundOrder.customer_email,
//     });

//     console.log(`Refund email sent to: ${refundOrder.customer_email}`);
//   } catch (error) {
//     console.error("Error in handlePaymentRefund:", {
//       error: error instanceof Error ? error.message : "Unknown error",
//       order_id: orderData.order_id,
//     });
//     throw error;
//   }
// }

async function handleOtherStatus(orderData: any) {
  try {
    console.log("Processing other status:", {
      order_id: orderData.order_id,
      status: orderData.order_status?.key,
      timestamp: new Date().toISOString(),
    });

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

    const { rows } = await pool.query(updateQuery, values);
    
    if (rows.length === 0) {
      console.warn(`Order not found in database: ${orderData.order_id}`);
      return;
    }

    console.log("Order status updated:", {
      id: rows[0].id,
      status: rows[0].status,
    });
  } catch (error) {
    console.error("Error in handleOtherStatus:", {
      error: error instanceof Error ? error.message : "Unknown error",
      order_id: orderData.order_id,
    });
    throw error;
  }
}