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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 📋 COMPREHENSIVE LOGGING - THIS IS WHAT YOU NEED TO SEE!
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔔 BOG PAYMENT CALLBACK RECEIVED");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📅 Callback Time: ${callbackData.zoned_request_time}`);
    console.log(`📡 Event Type: ${callbackData.event}`);
    console.log(`🆔 BOG Order ID: ${orderData.order_id}`);
    console.log(`📌 External Order ID: ${orderData.external_order_id}`);
    console.log(
      `📊 Order Status: ${orderData.order_status?.key} (${orderData.order_status?.value})`
    );

    // 💰 AMOUNT DETAILS
    console.log("\n💰 AMOUNT DETAILS:");
    console.log(
      `   Requested: ${orderData.purchase_units?.request_amount} ${orderData.purchase_units?.currency_code}`
    );
    console.log(
      `   Transferred: ${orderData.purchase_units?.transfer_amount || "0"} ${orderData.purchase_units?.currency_code}`
    );
    console.log(
      `   Refunded: ${orderData.purchase_units?.refund_amount || "0"} ${orderData.purchase_units?.currency_code}`
    );

    // 💳 PAYMENT DETAILS - THIS IS THE MOST IMPORTANT PART!
    if (orderData.payment_detail) {
      const pd = orderData.payment_detail;
      console.log("\n💳 PAYMENT DETAILS:");
      console.log(
        `   Method: ${pd.transfer_method?.key} (${pd.transfer_method?.value || "N/A"})`
      );
      console.log(`   Transaction ID: ${pd.transaction_id || "N/A"}`);
      console.log(`   🔢 Response Code: ${pd.code || "N/A"}`);
      console.log(
        `   📝 Response Description: ${pd.code_description || "N/A"}`
      );
      console.log(`   🔐 Auth Code: ${pd.auth_code || "N/A"}`);
      console.log(`   💳 Card Type: ${pd.card_type || "N/A"}`);
      console.log(`   🔒 Payer Identifier: ${pd.payer_identifier || "N/A"}`);
      console.log(`   Payment Option: ${pd.payment_option || "N/A"}`);

      // ✅ SUCCESS OR ❌ FAILURE
      if (pd.code === "100") {
        console.log("\n✅✅✅ PAYMENT SUCCESSFUL! ✅✅✅");
      } else if (pd.code) {
        console.log(`\n❌❌❌ PAYMENT FAILED! ❌❌❌`);
        console.log(`   Failure Code: ${pd.code}`);
        console.log(`   Failure Reason: ${pd.code_description}`);
      }
    } else {
      console.log(
        "\n⚠️ No payment_detail in callback (payment might still be processing)"
      );
    }

    // ⚠️ REJECT REASON (if any)
    if (orderData.reject_reason) {
      console.log(`\n⚠️ General Reject Reason: ${orderData.reject_reason}`);
    }

    // 👤 BUYER INFO
    if (orderData.buyer) {
      console.log("\n👤 BUYER INFO:");
      console.log(`   Name: ${orderData.buyer.full_name || "N/A"}`);
      console.log(`   Email: ${orderData.buyer.email || "N/A"}`);
      console.log(`   Phone: ${orderData.buyer.phone_number || "N/A"}`);
    }

    // 🛒 ITEMS
    if (orderData.purchase_units?.items?.length > 0) {
      console.log("\n🛒 PURCHASED ITEMS:");
      orderData.purchase_units.items.forEach((item: any, index: number) => {
        console.log(
          `   ${index + 1}. ${item.description || item.external_item_id}`
        );
        console.log(
          `      Quantity: ${item.quantity} x ${item.unit_price} = ${item.total_price}`
        );
      });
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 📊 PROCESS PAYMENT BASED ON STATUS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    switch (orderData.order_status?.key) {
      case "completed":
        console.log("💚 Processing successful payment...");
        await handlePaymentSuccess(orderData);
        break;
      case "rejected":
        console.log("💔 Processing failed payment...");
        await handlePaymentFailure(orderData);
        break;
      // case "refunded":
      //   console.log("💰 Processing refund...");
      //   await handlePaymentRefund(orderData);
      //   break;
      default:
        console.log(
          `📝 Processing other status: ${orderData.order_status?.key}`
        );
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

    // ⚠️ STILL RETURN 200 to prevent BOG from retrying
    res.status(200).json({
      success: false,
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
};

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
      orderData.purchase_units?.request_amount,
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
    console.log(
      `✅ Database updated successfully for order ID: ${successOrder.id}`
    );

    if (!successOrder.customer_email) {
      console.warn("⚠️ No customer email found, skipping success email");
      return;
    }

    console.log(`📧 Sending success email to: ${successOrder.customer_email}`);
    await sendPaymentSuccessEmail({
      firstName: successOrder.customer_first_name || "Customer",
      lastName: successOrder.customer_last_name || "",
      email: successOrder.customer_email,
      detailsLink: `https://daudtravel.com/tours/order/${successOrder.id}`,
    });
    console.log("✅ Success email sent!");
  } catch (error) {
    console.error("❌ Error in handlePaymentSuccess:", error);
    throw error;
  }
}

async function handlePaymentFailure(orderData: any) {
  try {
    // ✅ CAPTURE DETAILED FAILURE REASON
    const failureReason =
      orderData.payment_detail?.code_description || // Most detailed reason
      orderData.reject_reason || // General reason
      "Payment failed - unknown reason";

    console.log(`💔 Failure Reason: ${failureReason}`);
    console.log(`   Payment Code: ${orderData.payment_detail?.code || "N/A"}`);

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
      failureReason, // Store the detailed reason
      orderData.payment_detail?.code, // Store the response code
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
    console.log(
      `✅ Database updated with failure reason for order ID: ${failedOrder.id}`
    );
    console.log(`   Stored reason: ${failureReason}`);

    if (!failedOrder.customer_email) {
      console.warn("⚠️ No customer email found, skipping failure email");
      return;
    }

    // TODO: Uncomment when you implement failure email
    // console.log(`📧 Sending failure email to: ${failedOrder.customer_email}`);
    // await sendPaymentFailureEmail({
    //   firstName: failedOrder.customer_first_name || "Customer",
    //   lastName: failedOrder.customer_last_name || "",
    //   email: failedOrder.customer_email,
    //   rejectionReason: failureReason,
    // });
    // console.log("✅ Failure email sent!");
  } catch (error) {
    console.error("❌ Error in handlePaymentFailure:", error);
    throw error;
  }
}

// async function handlePaymentRefund(orderData: any) {
//   try {
//     console.log(`💰 Processing refund of ${orderData.purchase_units?.refund_amount}`);

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
//       console.warn(`⚠️ No order found in database for order_id: ${orderData.order_id}`);
//       return;
//     }

//     const refundOrder = rows[0];
//     console.log(`✅ Refund processed for order ID: ${refundOrder.id}`);

//     if (!refundOrder.customer_email) {
//       console.warn("⚠️ No customer email found, skipping refund email");
//       return;
//     }

//     console.log(`📧 Sending refund email to: ${refundOrder.customer_email}`);
//     await sendPaymentRefundEmail({
//       firstName: refundOrder.customer_first_name || "Customer",
//       lastName: refundOrder.customer_last_name || "",
//       email: refundOrder.customer_email,
//     });
//     console.log("✅ Refund email sent!");
//   } catch (error) {
//     console.error("❌ Error in handlePaymentRefund:", error);
//     throw error;
//   }
// }

async function handleOtherStatus(orderData: any) {
  try {
    console.log(`📝 Processing status: ${orderData.order_status?.key}`);

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

    if (rows.length > 0) {
      console.log(`✅ Status updated to: ${orderData.order_status?.key}`);
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
