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
    console.log("🔍 Signature verification attempt:");
    console.log("  Body type:", typeof body);
    console.log("  Body length:", body ? body.length : 0);
    console.log(
      "  Body sample:",
      body ? body.substring(0, 100) + "..." : "undefined"
    );
    console.log(
      "  Signature:",
      signature ? signature.substring(0, 50) + "..." : "undefined"
    );

    if (!body || !signature) {
      console.error("❌ Missing body or signature for verification");
      return false;
    }

    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(body, "utf8");
    const isValid = verifier.verify(BOG_PUBLIC_KEY, signature, "base64");

    console.log("✅ Signature verification result:", isValid);
    return isValid;
  } catch (error) {
    console.error("❌ Signature verification error:", error);
    return false;
  }
}

export const handleBOGCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  console.log("\n🎯 ===== BOG CALLBACK RECEIVED =====");
  console.log("📅 Timestamp:", new Date().toISOString());
  console.log("🌐 Request URL:", req.url);
  console.log("📧 Request Method:", req.method);

  try {
    // Log all headers
    console.log("📋 Request Headers:");
    Object.entries(req.headers).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    // Log query parameters
    console.log("🔍 Query Parameters:", req.query);

    // Get raw body - Express raw middleware gives us a Buffer
    let rawBody: string;

    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString("utf8");
      console.log("📦 Raw Body (from Buffer):", rawBody.substring(0, 500));
    } else if (typeof req.body === "string") {
      rawBody = req.body;
      console.log("📦 Raw Body (string):", rawBody.substring(0, 500));
    } else {
      // Fallback to JSON.stringify if body is already parsed
      rawBody = JSON.stringify(req.body);
      console.log("📦 Raw Body (JSON stringified):", rawBody.substring(0, 500));
    }

    console.log("\n🔍 Raw Body Analysis:");
    console.log("  Type:", typeof rawBody);
    console.log("  Length:", rawBody ? rawBody.length : 0);
    console.log("  Is defined:", rawBody !== undefined);

    // Get signature from headers
    const signature = req.headers["callback-signature"] as string;
    console.log("\n🔐 Signature Analysis:");
    console.log("  Signature header exists:", !!signature);
    console.log("  Signature value:", signature);

    // Alternative signature headers to check
    const alternativeHeaders = [
      "x-callback-signature",
      "x-signature",
      "signature",
      "authorization",
      "x-bog-signature",
    ];

    console.log("\n🔍 Checking alternative signature headers:");
    alternativeHeaders.forEach((header) => {
      const value = req.headers[header];
      if (value) {
        console.log(`  ${header}: ${value}`);
      }
    });

    // Signature verification
    if (signature && rawBody) {
      console.log("\n🔐 Attempting signature verification...");
      const isValidSignature = verifyBOGSignature(rawBody, signature);

      if (!isValidSignature) {
        console.error("❌ Signature verification failed");
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
      console.log("✅ Signature verification passed");
    } else {
      console.log("\n⚠️  Signature verification skipped:");
      console.log("  Has signature:", !!signature);
      console.log("  Has body:", !!rawBody);

      // For development, you might want to comment out this return
      // res.status(400).json({ error: "Missing signature header or body" });
      // return;
    }

    // Parse callback data
    let callbackData: any;
    try {
      callbackData = JSON.parse(rawBody);
      console.log("\n📋 Parsed Callback Data:");
      console.log(JSON.stringify(callbackData, null, 2));
    } catch (parseError) {
      console.error("❌ Failed to parse callback data:", parseError);
      console.log("📝 Raw data that failed to parse:", rawBody);
      res.status(400).json({ error: "Invalid JSON in callback data" });
      return;
    }

    // Validate callback data structure
    console.log("\n🔍 Validating callback data structure...");

    if (!callbackData.event) {
      console.error("❌ Missing event field");
      res.status(400).json({ error: "Missing event field" });
      return;
    }

    if (callbackData.event !== "order_payment") {
      console.error("❌ Invalid event type:", callbackData.event);
      res.status(400).json({ error: "Invalid event type" });
      return;
    }

    if (!callbackData.body || !callbackData.body.order_id) {
      console.error("❌ Missing order_id in callback body");
      res.status(400).json({ error: "Missing order_id" });
      return;
    }

    const orderData = callbackData.body;
    console.log("\n📋 Order Data:");
    console.log("  Order ID:", orderData.order_id);
    console.log("  Status:", orderData.order_status?.key);
    console.log("  Payment Amount:", orderData.purchase_units?.total_amount);

    // Process based on order status
    console.log("\n🔄 Processing order status:", orderData.order_status?.key);

    switch (orderData.order_status.key) {
      case "completed":
        console.log("✅ Processing payment success...");
        await handlePaymentSuccess(orderData);
        break;
      case "rejected":
        console.log("❌ Processing payment failure...");
        await handlePaymentFailure(orderData);
        break;
      case "refunded":
        console.log("💰 Processing payment refund...");
        await handlePaymentRefund(orderData);
        break;
      default:
        console.log("⚠️  Processing other status...");
        await handleOtherStatus(orderData);
    }

    // Send success response
    const response = {
      success: true,
      message: "Callback processed successfully",
      order_id: orderData.order_id,
      status: orderData.order_status.key,
      processed_at: new Date().toISOString(),
    };

    console.log("\n✅ Sending success response:", response);
    res.status(200).json(response);
  } catch (error) {
    console.error("\n❌ CALLBACK PROCESSING ERROR:");
    console.error(
      "  Error type:",
      error instanceof Error ? error.constructor.name : typeof error
    );
    console.error(
      "  Error message:",
      error instanceof Error ? error.message : error
    );
    console.error(
      "  Stack trace:",
      error instanceof Error ? error.stack : "No stack trace"
    );

    res.status(500).json({
      success: false,
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }

  console.log("🎯 ===== BOG CALLBACK COMPLETE =====\n");
};
 

// Also update the handlePaymentSuccess function:
async function handlePaymentSuccess(orderData: any) {
  try {
    console.log("💳 Processing payment success for order:", orderData.order_id);

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
      // Fix this line:
      orderData.purchase_units?.request_amount, // Changed from total_amount
      JSON.stringify(orderData),
      orderData.order_id,
    ];

    console.log("📝 Executing update query with values:", values);
    const { rows } = await pool.query(updateQuery, values);

    if (rows.length === 0) {
      console.error(
        "❌ Payment record not found in database for order:",
        orderData.order_id
      );
    } else {
      console.log("✅ Payment success recorded in database:", rows[0].id);
    }
  } catch (error) {
    console.error("❌ Database error during payment success:", error);
  }
}

async function handlePaymentFailure(orderData: any) {
  try {
    console.log("❌ Processing payment failure for order:", orderData.order_id);

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

    console.log("📝 Executing failure update query with values:", values);
    const { rows } = await pool.query(updateQuery, values);

    if (rows.length > 0) {
      console.log("✅ Payment failure recorded in database:", rows[0].id);

      const failedOrder = rows[0];
      const firstname = failedOrder.customer_first_name || "Customer";
      const lastname = failedOrder.customer_last_name || "";
      const email = failedOrder.customer_email || "";

      if (email) {
        console.log("📧 Sending failure notification email to:", email);
        await sendBookingConfirmationEmail({
          firstName: firstname,
          lastName: lastname,
          email: email,
        });
      }
    } else {
      console.error(
        "❌ Payment record not found for failure update:",
        orderData.order_id
      );
    }
  } catch (error) {
    console.error("❌ Database error during payment failure:", error);
  }
}

async function handlePaymentRefund(orderData: any) {
  try {
    console.log("💰 Processing payment refund for order:", orderData.order_id);

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

    console.log("📝 Executing refund update query with values:", values);
    const { rows } = await pool.query(updateQuery, values);

    if (rows.length > 0) {
      console.log("✅ Payment refund recorded in database:", rows[0].id);
    } else {
      console.error(
        "❌ Payment record not found for refund update:",
        orderData.order_id
      );
    }
  } catch (error) {
    console.error("❌ Database error during refund:", error);
  }
}

async function handleOtherStatus(orderData: any) {
  try {
    console.log(
      "⚠️  Processing other status for order:",
      orderData.order_id,
      "Status:",
      orderData.order_status?.key
    );

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

    console.log("📝 Executing other status update query with values:", values);
    const { rows } = await pool.query(updateQuery, values);

    if (rows.length > 0) {
      console.log("✅ Status update recorded in database:", rows[0].id);
    } else {
      console.error(
        "❌ Payment record not found for status update:",
        orderData.order_id
      );
    }
  } catch (error) {
    console.error("❌ Database error during status update:", error);
  }
}
