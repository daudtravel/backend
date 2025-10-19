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
    res.status(500).json({
      success: false,
      message: "Failed to get receipt status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
