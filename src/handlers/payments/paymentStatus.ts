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
    // 🔍 STEP 1: Check database first
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let bogOrderId = order_id;
    let dbOrder = null;

    // Determine if this is an external_order_id or bog_order_id
    const isExternalOrderId = order_id.startsWith("ORDER_");

    const lookupQuery = `
      SELECT 
        bog_order_id, 
        external_order_id,
        status, 
        rejection_reason,
        payment_response_code,
        callback_data,
        amount_paid,
        payment_method,
        transaction_id,
        customer_email,
        tour_name,
        failed_at,
        paid_at
      FROM payment_orders 
      WHERE ${isExternalOrderId ? "external_order_id" : "bog_order_id"} = $1
      LIMIT 1;
    `;

    const { rows } = await pool.query(lookupQuery, [order_id]);

    if (rows.length > 0) {
      dbOrder = rows[0];
      bogOrderId = dbOrder.bog_order_id;
      console.log(`✅ Found order in database`);
      console.log(`   BOG Order ID: ${bogOrderId}`);
      console.log(`   Current status: ${dbOrder.status}`);

      if (dbOrder.rejection_reason) {
        console.log(`   Rejection reason: ${dbOrder.rejection_reason}`);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🎯 IF DATABASE HAS COMPLETED/FAILED STATUS, RETURN IT!
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (dbOrder.status === "completed" || dbOrder.status === "failed") {
        console.log(`✅ Using cached status from database: ${dbOrder.status}`);

        const isSuccessful = dbOrder.status === "completed";

        // Build comprehensive response from database
        const response = {
          success: isSuccessful,
          order_id: bogOrderId,
          external_order_id: dbOrder.external_order_id,
          status: dbOrder.status,
          status_description: isSuccessful
            ? "Payment completed successfully"
            : dbOrder.rejection_reason || "Payment failed",

          // ✅ CRITICAL: Include payment response details
          payment_response: {
            code:
              dbOrder.payment_response_code || (isSuccessful ? "100" : null),
            description:
              dbOrder.rejection_reason ||
              (isSuccessful ? "Transaction approved" : "Payment failed"),
            is_successful: isSuccessful,
          },

          amount: {
            requested: parseFloat(dbOrder.amount_paid || "0"),
            transferred: isSuccessful
              ? parseFloat(dbOrder.amount_paid || "0")
              : 0,
            refunded: 0,
            currency: "GEL",
          },

          payment_method: dbOrder.payment_method || "card",
          transaction_id: dbOrder.transaction_id,

          // Include timing information
          ...(dbOrder.failed_at && { failed_at: dbOrder.failed_at }),
          ...(dbOrder.paid_at && { paid_at: dbOrder.paid_at }),
        };

        // Add full callback data if available
        if (dbOrder.callback_data) {
          try {
            const callbackData = JSON.parse(dbOrder.callback_data);
            response.full_details = callbackData;
          } catch (e) {
            console.warn("⚠️ Failed to parse callback_data");
          }
        }

        res.status(200).json(response);
        return;
      }
    } else if (isExternalOrderId) {
      // If no database record found for external_order_id
      console.warn(`⚠️ No order found with external_order_id: ${order_id}`);
      res.status(404).json({
        success: false,
        message: "Order not found in database",
        order_id: order_id,
      });
      return;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🔍 STEP 2: If status is "pending", fetch from BOG API
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log(`📡 Status is pending, fetching from BOG API...`);

    const accessToken = await getBOGAccessToken();
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

        // If we have database info, return it
        if (dbOrder) {
          console.log(`✅ Returning database info for pending order`);

          res.status(200).json({
            success: false,
            order_id: bogOrderId,
            external_order_id: dbOrder.external_order_id,
            status: dbOrder.status || "pending",
            status_description: "Payment session expired or cancelled",

            payment_response: {
              code: null,
              description:
                "Payment was not completed. The session may have expired or been cancelled.",
              is_successful: false,
            },

            message:
              "Payment session expired or was cancelled before completion",
          });
          return;
        }

        // No database record either
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
    // ✅ RETURN RESPONSE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const isSuccessful =
      receipt.order_status.key === "completed" &&
      receipt.payment_detail?.code === "100";

    res.status(200).json({
      success: isSuccessful,
      order_id: receipt.order_id,
      external_order_id: receipt.external_order_id,
      status: receipt.order_status.key,
      status_description: receipt.order_status.value,

      // ✅ CRITICAL: Include payment response details
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
