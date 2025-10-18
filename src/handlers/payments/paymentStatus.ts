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

    console.log(`[BOG Receipt] Checking status for order: ${order_id}`);

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
        console.log(`[BOG Receipt] Order not found: ${order_id}`);
        res.status(404).json({
          success: false,
          message: "Receipt not found",
          order_id: order_id,
        });
        return;
      }

      const errorText = await response.text();
      console.error(`[BOG Receipt] API Error for ${order_id}:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(`BOG API error: ${response.statusText} - ${errorText}`);
    }

    const receipt = await response.json();

    // ===== DETAILED PAYMENT STATUS LOGGING =====
    console.log(`\n========== BOG Receipt Details: ${order_id} ==========`);
    console.log(
      `Status: ${receipt.order_status.key} - ${receipt.order_status.value}`
    );
    console.log(`External Order ID: ${receipt.external_order_id}`);

    // Log payment amounts
    console.log(`\nAmounts:`);
    console.log(
      `  Requested: ${receipt.purchase_units.request_amount} ${receipt.purchase_units.currency_code}`
    );
    console.log(
      `  Transferred: ${receipt.purchase_units.transfer_amount} ${receipt.purchase_units.currency_code}`
    );
    console.log(
      `  Refunded: ${receipt.purchase_units.refund_amount} ${receipt.purchase_units.currency_code}`
    );

    // Log payment method details
    if (receipt.payment_detail) {
      console.log(
        `\nPayment Method: ${receipt.payment_detail.transfer_method.key}`
      );
      console.log(`Transaction ID: ${receipt.payment_detail.transaction_id}`);
    } else {
      console.log(`\nPayment Detail: No payment details available`);
    }

    // Log failure/rejection reason if exists
    if (receipt.reject_reason) {
      console.log(
        `\n⚠️  REJECT REASON: ${JSON.stringify(receipt.reject_reason, null, 2)}`
      );
    }

    // Log buyer information
    if (receipt.buyer) {
      console.log(`\nBuyer Info:`);
      console.log(`  Full Name: ${receipt.buyer.full_name || "N/A"}`);
      console.log(`  Mobile: ${receipt.buyer.mobile_number || "N/A"}`);
    }

    // Log timestamps
    console.log(`\nTimestamps:`);
    console.log(`  Created: ${receipt.zoned_create_date}`);
    console.log(`  Expires: ${receipt.zoned_expire_date}`);

    // Check for common failure scenarios
    if (
      receipt.order_status.key !== "COMPLETED" &&
      receipt.order_status.key !== "SUCCESS"
    ) {
      console.log(`\n❌ PAYMENT FAILED/INCOMPLETE`);
      console.log(`Status Key: ${receipt.order_status.key}`);

      if (receipt.reject_reason) {
        console.log(`Reason: ${receipt.reject_reason}`);
      }

      // Log full receipt for debugging failed payments
      console.log(`\nFull Receipt Data:`, JSON.stringify(receipt, null, 2));
    } else {
      console.log(`\n✅ PAYMENT SUCCESSFUL`);
    }

    console.log(`========== End Receipt Details ==========\n`);

    res.status(200).json({
      success: true,
      order_id: receipt.order_id,
      external_order_id: receipt.external_order_id,
      status: receipt.order_status.key,
      status_description: receipt.order_status.value,
      amount: {
        requested: parseFloat(receipt.purchase_units.request_amount),
        transferred: parseFloat(receipt.purchase_units.transfer_amount),
        refunded: parseFloat(receipt.purchase_units.refund_amount),
        currency: receipt.purchase_units.currency_code,
      },
      payment_method: receipt.payment_detail?.transfer_method.key,
      transaction_id: receipt.payment_detail?.transaction_id,
      created_at: receipt.zoned_create_date,
      expires_at: receipt.zoned_expire_date,
      buyer: receipt.buyer,
      reject_reason: receipt.reject_reason,
      full_details: receipt,
    });
  } catch (error) {
    console.error(`[BOG Receipt] Fatal error:`, error);
    res.status(500).json({
      success: false,
      message: "Failed to get receipt status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
