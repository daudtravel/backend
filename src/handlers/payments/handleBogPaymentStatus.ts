import type { Request, Response } from "express";

import { getBOGAccessToken } from "./getBOGAccessToken";
import { BOG_API_URL, MOCK_MODE } from "./payments";

interface BOGPaymentDetails {
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

export const getBOGPaymentStatus = async (
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

    console.log("🔍 Checking payment status for order:", order_id);

    let paymentDetails: BOGPaymentDetails;

    if (MOCK_MODE) {
      // Mock response for testing
      paymentDetails = {
        order_id: order_id,
        industry: "ecommerce",
        capture: "automatic",
        external_order_id: `ORDER_${order_id.split("_")[1] || "test"}`,
        client: {
          id: "10000",
          brand_ka: "Test Business",
          brand_en: "Test Business",
          url: "https://example.com",
        },
        zoned_create_date: new Date().toISOString(),
        zoned_expire_date: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        order_status: {
          key: "completed",
          value: "Completed",
        },
        purchase_units: {
          request_amount: "10.00",
          transfer_amount: "10.00",
          refund_amount: "0.00",
          currency_code: "GEL",
          items: [
            {
              external_item_id: "PRODUCT_test",
              description: "Test Product",
              quantity: "1",
              unit_price: "10.00",
              total_price: "10.00",
            },
          ],
        },
        payment_detail: {
          transfer_method: {
            key: "card",
            value: "Card Payment",
          },
          transaction_id: "mock_transaction_123",
          payer_identifier: "548888xxxxxx9893",
          payment_option: "direct_debit",
          card_type: "visa",
          code: "100",
          code_description: "Successful payment",
        },
      };
    } else {
      // Real BOG API call
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
            message: "Payment not found",
            order_id: order_id,
          });
          return;
        }

        const errorText = await response.text();
        throw new Error(`BOG API error: ${response.statusText} - ${errorText}`);
      }

      paymentDetails = await response.json();
    }

    console.log(
      "📊 Payment status retrieved:",
      paymentDetails.order_status.key
    );

    // Return formatted response
    res.status(200).json({
      success: true,
      order_id: paymentDetails.order_id,
      external_order_id: paymentDetails.external_order_id,
      status: paymentDetails.order_status.key,
      status_description: paymentDetails.order_status.value,
      amount: {
        requested: parseFloat(paymentDetails.purchase_units.request_amount),
        transferred: parseFloat(paymentDetails.purchase_units.transfer_amount),
        refunded: parseFloat(paymentDetails.purchase_units.refund_amount),
        currency: paymentDetails.purchase_units.currency_code,
      },
      payment_method: paymentDetails.payment_detail?.transfer_method.key,
      transaction_id: paymentDetails.payment_detail?.transaction_id,
      created_at: paymentDetails.zoned_create_date,
      expires_at: paymentDetails.zoned_expire_date,
      buyer: paymentDetails.buyer,
      reject_reason: paymentDetails.reject_reason,
      full_details: paymentDetails, // Include full response for debugging
    });
  } catch (error) {
    console.error("❌ Error getting BOG payment status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get payment status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
