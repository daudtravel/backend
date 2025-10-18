import type { Request, Response } from "express";
import { getBOGAccessToken } from "../payments/getBOGAccessToken";
import { BOG_API_URL } from "../payments/payments";

/**
 * Fetch payment receipt and return structured info about payment status.
 */
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

    // Step 1: Retrieve access token securely
    const accessToken = await getBOGAccessToken();

    // Step 2: Fetch payment receipt from BOG API
    const response = await fetch(`${BOG_API_URL}/receipt/${order_id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    // Handle non-200 HTTP responses
    if (!response.ok) {
      if (response.status === 404) {
        res.status(404).json({
          success: false,
          message: "Receipt not found",
          order_id,
        });
        return;
      }

      const errorText = await response.text();
      throw new Error(`BOG API error: ${response.statusText} - ${errorText}`);
    }

    // Step 3: Parse successful response
    const receipt = await response.json();

    // Step 4: Construct structured response for frontend
    const success =
      receipt.order_status?.key === "completed" &&
      receipt.payment_detail?.code === "100";

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

      // 🔍 Key fields for success/failure debugging
      payment_code: receipt.payment_detail?.code,
      payment_code_description: receipt.payment_detail?.code_description,
      reject_reason: receipt.reject_reason,

      // Optional: include for deeper debugging or logs
      full_details: receipt,
    });
  } catch (error) {
    console.error("Error fetching BOG receipt:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get receipt status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
