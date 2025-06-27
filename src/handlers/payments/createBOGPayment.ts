import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { BOG_API_URL, getCallbackUrl, MOCK_MODE } from "../payments";
// Removed pool import - no database operations
import { getBOGAccessToken } from "./getBOGAccessToken";

export const createBOGPayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Enhanced request body with more display options
    const {
      amount,
      currency = "GEL",
      description = "Payment",
      product_name,
      product_details,
      merchant_name,
      items = [],
    } = req.body;

    // Basic validation
    if (!amount) {
      res.status(400).json({
        message: "Amount is required",
      });
      return;
    }

    // Generate unique order ID
    const external_order_id = `ORDER_${uuidv4()}`;

    const accessToken = await getBOGAccessToken();

    // Minimal BOG request structure
    const bogOrderRequest = {
      callback_url: getCallbackUrl(),
      external_order_id,
      purchase_units: {
        currency: currency.toUpperCase(),
        total_amount: amount,
        basket: [
          {
            product_id: `PRODUCT_${uuidv4()}`,
            description: description,
            quantity: 1,
            unit_price: amount,
          },
        ],
      },
      redirect_urls: {
        success: `${process.env.BASE_URL}/payment-success`,
        fail: `${process.env.BASE_URL}/payment-fail`,
      },
      ttl: 30, // 30 minutes timeout
    };

    let bogOrderData: any;

    if (MOCK_MODE) {
      // Mock response for testing
      const mockOrderId = `mock_${uuidv4()}`;
      bogOrderData = {
        id: mockOrderId,
        _links: {
          details: {
            href: `https://api.bog.ge/payments/v1/receipt/${mockOrderId}`,
          },
          redirect: {
            href: `https://payment.bog.ge/?order_id=${mockOrderId}`,
          },
        },
      };
    } else {
      // Real BOG API call
      const bogResponse = await fetch(`${BOG_API_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Accept-Language": "en",
        },
        body: JSON.stringify(bogOrderRequest),
      });

      if (!bogResponse.ok) {
        const errorText = await bogResponse.text();
        throw new Error(
          `BOG API error: ${bogResponse.statusText} - ${errorText}`
        );
      }

      bogOrderData = await bogResponse.json();
    }

    // Save to database (simplified)
    // Log payment data instead of saving to database
    console.log("🏦 BOG Payment Created:", {
      order_id: bogOrderData.id,
      external_order_id,
      amount,
      currency: currency.toUpperCase(),
      description,
      payment_url: bogOrderData._links.redirect.href,
      status: "pending",
      created_at: new Date().toISOString(),
    });

    // Return simple response
    res.status(201).json({
      success: true,
      order_id: bogOrderData.id,
      payment_url: bogOrderData._links.redirect.href,
      amount: amount,
      currency: currency.toUpperCase(),
    });
  } catch (error) {
    console.error("Error creating BOG payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
