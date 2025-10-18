import type { Request, Response } from "express";
import { getBOGAccessToken } from "../payments/getBOGAccessToken";
import { BOG_API_URL } from "../payments/payments";

/**
 * Fetch payment receipt from BOG API and return structured info to frontend.
 */
export const getBOGReceiptStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    let { order_id } = req.params;

    if (!order_id) {
      res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
      return;
    }

    // 🔹 Clean up prefixed IDs like "ORDER_1234..."
    const cleanOrderId = order_id.replace(/^ORDER_/, "");

    // Step 1: Retrieve access token securely
    const accessToken = await getBOGAccessToken();

    // Step 2: Fetch payment receipt from BOG API
    const response = await fetch(`${BOG_API_URL}/receipt/${cleanOrderId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    // Step 3: Handle API errors gracefully
    if (!response.ok) {
      const errorText = await response.text();

      console.error("❌ BOG API Error Response:", errorText);

      res.status(response.status).json({
        success: false,
        message: "BOG API returned an error",
        details: errorText,
        order_id: cleanOrderId,
      });
      return;
    }

    // Step 4: Parse successful response
    const receipt = await response.json();

    // Step 5: Determine success based on order_status + payment code
    const success =
      receipt.order_status?.key === "completed" &&
      receipt.payment_detail?.code === "100";

    // Step 6: Send structured, developer-friendly JSON to frontend
    res.status(200).json({
      success,
      order_id: receipt.order_id,
      external_order_id: receipt.external_order_id,

      // Payment status & description
      status: receipt.order_status?.key,
      status_description: receipt.order_status?.value,

      // Amount details
      amount: {
        requested: parseFloat(receipt.purchase_units.request_amount),
        transferred: parseFloat(receipt.purchase_units.transfer_amount),
        refunded: parseFloat(receipt.purchase_units.refund_amount),
        currency: receipt.purchase_units.currency_code,
      },

      // Buyer & transaction details
      buyer: receipt.buyer,
      payment_method: receipt.payment_detail?.transfer_method?.key,
      transaction_id: receipt.payment_detail?.transaction_id,
      created_at: receipt.zoned_create_date,
      expires_at: receipt.zoned_expire_date,

      // 🔍 Debug + failure reason fields
      payment_code: receipt.payment_detail?.code,
      payment_code_description: receipt.payment_detail?.code_description,
      reject_reason: receipt.reject_reason,

      // Include original data for deeper debugging (dev only)
      full_details: receipt,
    });
  } catch (error) {
    console.error("🔥 Error fetching BOG receipt:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get receipt status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
