import type { Request, Response } from "express";
import { getBOGAccessToken } from "../payments/getBOGAccessToken";
import { BOG_API_URL } from "../payments/payments";
import pool from "../../config/sql";

export const getBOGReceiptStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { order_id } = req.params;

    if (!order_id) {
      res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
      return;
    }

    console.log(`\n🔍 Looking up order: ${order_id}`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🔍 STEP 1: Check if this is external_order_id (ORDER_xxx)
    // If so, look up the bog_order_id from database
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let bogOrderId = order_id;

    if (order_id.startsWith("ORDER_")) {
      console.log(
        "📌 This is an external_order_id, looking up bog_order_id..."
      );

      const lookupQuery = `
        SELECT bog_order_id, status 
        FROM payment_orders 
        WHERE external_order_id = $1
        LIMIT 1;
      `;

      const { rows } = await pool.query(lookupQuery, [order_id]);

      if (rows.length === 0) {
        console.warn(`⚠️ No order found with external_order_id: ${order_id}`);
        res.status(404).json({
          success: false,
          message: "Order not found in database",
          order_id: order_id,
        });
        return;
      }

      bogOrderId = rows[0].bog_order_id;
      console.log(`✅ Found bog_order_id: ${bogOrderId}`);
      console.log(`   Current status in DB: ${rows[0].status}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🔍 STEP 2: Fetch receipt from BOG API using bog_order_id
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const accessToken = await getBOGAccessToken();

    console.log(`📡 Fetching receipt from BOG API...`);
    const response = await fetch(`${BOG_API_URL}/receipt/${bogOrderId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.error(`❌ BOG API: Receipt not found for ${bogOrderId}`);
        res.status(404).json({
          success: false,
          message: "Receipt not found in BOG system",
          order_id: order_id,
          bog_order_id: bogOrderId,
        });
        return;
      }

      const errorText = await response.text();
      console.error(`❌ BOG API error: ${errorText}`);
      throw new Error(`BOG API error: ${response.statusText} - ${errorText}`);
    }

    const receipt = await response.json();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 📋 LOG RECEIPT DETAILS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 BOG RECEIPT STATUS");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`🆔 BOG Order ID: ${receipt.order_id}`);
    console.log(`📌 External Order ID: ${receipt.external_order_id}`);
    console.log(`📊 Status: ${receipt.order_status.key}`);
    console.log(`🔢 Response Code: ${receipt.payment_detail?.code || "N/A"}`);
    console.log(
      `📝 Response Description: ${receipt.payment_detail?.code_description || "N/A"}`
    );
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ✅ RETURN RESPONSE WITH PAYMENT_RESPONSE OBJECT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    res.status(200).json({
      success: receipt.order_status.key === "completed",
      order_id: receipt.order_id,
      external_order_id: receipt.external_order_id,
      status: receipt.order_status.key,
      status_description: receipt.order_status.value,

      // ✅ CRITICAL: Include payment response details for frontend
      payment_response: {
        code: receipt.payment_detail?.code,
        description: receipt.payment_detail?.code_description,
        is_successful: receipt.payment_detail?.code === "100",
      },

      amount: {
        requested: parseFloat(receipt.purchase_units.request_amount),
        transferred: parseFloat(receipt.purchase_units.transfer_amount || "0"),
        refunded: parseFloat(receipt.purchase_units.refund_amount || "0"),
        currency: receipt.purchase_units.currency_code,
      },

      payment_method: receipt.payment_detail?.transfer_method?.key,
      transaction_id: receipt.payment_detail?.transaction_id,
      card_type: receipt.payment_detail?.card_type,
      payer_identifier: receipt.payment_detail?.payer_identifier,

      created_at: receipt.zoned_create_date,
      expires_at: receipt.zoned_expire_date,
      buyer: receipt.buyer,

      reject_reason: receipt.reject_reason,

      full_details: receipt,
    });
  } catch (error) {
    console.error("❌ Error fetching BOG receipt:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get receipt status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
