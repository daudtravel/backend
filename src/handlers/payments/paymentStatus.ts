import type { Request, Response } from "express";
import { getBOGAccessToken } from "../payments/getBOGAccessToken";
import { BOG_API_URL } from "../payments/payments";

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

    const accessToken = await getBOGAccessToken();

    const response = await fetch(`${BOG_API_URL}/receipt/${order_id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        res.status(404).json({
          success: false,
          message: "Receipt not found",
          order_id: order_id,
        });
        return;
      }

      const errorText = await response.text();
      throw new Error(`BOG API error: ${response.statusText} - ${errorText}`);
    }

    const receipt = await response.json();

    // ✅ LOG ALL PAYMENT DETAILS TO CONSOLE
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 BOG PAYMENT RECEIPT DETAILS");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`🆔 Order ID: ${receipt.order_id}`);
    console.log(`📌 External Order ID: ${receipt.external_order_id}`);
    console.log(
      `📊 Status: ${receipt.order_status.key} (${receipt.order_status.value})`
    );
    console.log(
      `💰 Amount: ${receipt.purchase_units.request_amount} ${receipt.purchase_units.currency_code}`
    );

    // ✅ THIS IS WHERE YOU SEE SUCCESS/FAILURE REASONS
    if (receipt.payment_detail) {
      console.log("\n💳 PAYMENT DETAILS:");
      console.log(`   Method: ${receipt.payment_detail.transfer_method?.key}`);
      console.log(
        `   Transaction ID: ${receipt.payment_detail.transaction_id || "N/A"}`
      );
      console.log(
        `   🔢 Response Code: ${receipt.payment_detail.code || "N/A"}`
      );
      console.log(
        `   📝 Response Description: ${receipt.payment_detail.code_description || "N/A"}`
      );
      console.log(
        `   💳 Card Type: ${receipt.payment_detail.card_type || "N/A"}`
      );
      console.log(
        `   🔒 Payer: ${receipt.payment_detail.payer_identifier || "N/A"}`
      );
    }

    // ✅ LOG REJECT REASON (if exists)
    if (receipt.reject_reason) {
      console.log(`\n❌ Reject Reason: ${receipt.reject_reason}`);
    }

    // ✅ LOG ACTIONS HISTORY
    if (receipt.actions && receipt.actions.length > 0) {
      console.log("\n📜 ACTIONS HISTORY:");
      receipt.actions.forEach((action: any) => {
        console.log(
          `   - ${action.action} | Status: ${action.status} | Amount: ${action.amount}`
        );
      });
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // ✅ ENHANCED RESPONSE WITH ALL IMPORTANT FIELDS
    res.status(200).json({
      success: receipt.order_status.key === "completed",
      order_id: receipt.order_id,
      external_order_id: receipt.external_order_id,
      status: receipt.order_status.key,
      status_description: receipt.order_status.value,

      // ✅ MOST IMPORTANT: Payment response code and description
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

      // ✅ FAILURE REASONS
      reject_reason: receipt.reject_reason,

      // ✅ Optional: Include full details for debugging
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
