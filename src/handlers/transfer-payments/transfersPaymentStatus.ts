import type { Request, Response } from "express";
import { getBOGAccessToken } from "../payments/getBOGAccessToken";
import { BOG_API_URL } from "../payments/payments";

interface BOGTransferDetails {
  order_id: string;
  industry: string;
  capture: string;
  external_order_id: string;
  client: {
    id: string;
    brand_ka: string;
    brand_en: string;
    url: string;
  };
  zoned_create_date: string;
  zoned_expire_date: string;
  order_status: {
    key: string;
    value: string;
  };
  buyer?: {
    full_name: string;
    email: string;
    phone_number: string;
  };
  purchase_units: {
    request_amount: string;
    transfer_amount: string;
    refund_amount: string;
    currency_code: string;
    items: Array<{
      external_item_id: string;
      description: string;
      quantity: string;
      unit_price: string;
      total_price: string;
    }>;
  };
  payment_detail?: {
    transfer_method: {
      key: string;
      value: string;
    };
    transaction_id: string;
    payer_identifier: string;
    payment_option: string;
    card_type?: string;
    code: string;
    code_description: string;
  };
  reject_reason?: string;
}

export const getBOGTransferStatus = async (
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

    let transferDetails: BOGTransferDetails;

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
          message: "Transfer payment not found",
          order_id: order_id,
        });
        return;
      }

      const errorText = await response.text();
      throw new Error(`BOG API error: ${response.statusText} - ${errorText}`);
    }

    transferDetails = await response.json();

    res.status(200).json({
      success: true,
      order_id: transferDetails.order_id,
      external_order_id: transferDetails.external_order_id,
      status: transferDetails.order_status.key,
      status_description: transferDetails.order_status.value,
      amount: {
        requested: parseFloat(transferDetails.purchase_units.request_amount),
        transferred: parseFloat(transferDetails.purchase_units.transfer_amount),
        refunded: parseFloat(transferDetails.purchase_units.refund_amount),
        currency: transferDetails.purchase_units.currency_code,
      },
      payment_method: transferDetails.payment_detail?.transfer_method.key,
      transaction_id: transferDetails.payment_detail?.transaction_id,
      created_at: transferDetails.zoned_create_date,
      expires_at: transferDetails.zoned_expire_date,
      buyer: transferDetails.buyer,
      reject_reason: transferDetails.reject_reason,
      full_details: transferDetails,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get transfer payment status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
