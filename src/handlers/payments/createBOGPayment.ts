import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getBOGAccessToken } from "./getBOGAccessToken";
import { BOG_API_URL, getCallbackUrl, MOCK_MODE } from "./payments";
import pool from "../../config/sql"; // Your database connection

interface CustomerData {
  firstName: string;
  lastName: string;
  age: string;
}

interface PaymentRequest {
  amount: number;
  currency?: string;
  description?: string;
  product_name?: string;
  merchant_name?: string;
  customer_data?: CustomerData;
}

export const createBOGPaymentWithCustomerData = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      amount,
      currency = "GEL",
      description = "Payment",
      product_name,
      merchant_name,
      customer_data,
    }: PaymentRequest = req.body;

    // Validate required fields
    if (!amount || amount <= 0) {
      res.status(400).json({
        success: false,
        message: "Amount is required and must be positive",
      });
      return;
    }

    if (
      !customer_data ||
      !customer_data.firstName ||
      !customer_data.lastName ||
      !customer_data.age
    ) {
      res.status(400).json({
        success: false,
        message: "Customer data (firstName, lastName, age) is required",
      });
      return;
    }

    // Create unique order ID
    const external_order_id = `ORDER_${uuidv4()}`;

    console.log("🏦 Creating BOG payment with customer data:", {
      external_order_id,
      amount,
      currency: currency.toUpperCase(),
      customer: customer_data,
    });

    // Get BOG access token
    const accessToken = await getBOGAccessToken();

    // Prepare BOG order request
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
            total_price: amount,
          },
        ],
      },
      redirect_urls: {
        success: `http://localhost:3000/payment-success?order_id=${external_order_id}`,
        fail: `http://localhost:3000/payment-failure?order_id=${external_order_id}`,
      },
      ttl: 30,
    };

    let bogOrderData: any;

    if (MOCK_MODE) {
      const mockOrderId = `mock_${uuidv4()}`;
      bogOrderData = {
        id: mockOrderId,
        _links: {
          details: { href: `${BOG_API_URL}/receipt/${mockOrderId}` },
          redirect: { href: `https://payment.bog.ge/?order_id=${mockOrderId}` },
        },
      };
      console.log("🧪 Mock payment created:", mockOrderId);
    } else {
      const bogResponse = await fetch(`${BOG_API_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Accept-Language": "en",
          "Idempotency-Key": uuidv4(),
        },
        body: JSON.stringify(bogOrderRequest),
      });

      if (!bogResponse.ok) {
        const errorText = await bogResponse.text();
        console.error("❌ BOG API Error:", {
          status: bogResponse.status,
          statusText: bogResponse.statusText,
          body: errorText,
        });
        throw new Error(
          `BOG API error: ${bogResponse.statusText} - ${errorText}`
        );
      }

      bogOrderData = await bogResponse.json();
      console.log("✅ BOG payment created:", bogOrderData.id);
    }

    // Save payment record to database with customer data
    const paymentRecord = {
      bog_order_id: bogOrderData.id,
      external_order_id,
      amount,
      currency: currency.toUpperCase(),
      description,
      product_name,
      customer_first_name: customer_data.firstName,
      customer_last_name: customer_data.lastName,
      customer_age: Number.parseInt(customer_data.age),
      payment_url: bogOrderData._links.redirect.href,
      callback_url: getCallbackUrl(),
      status: "pending",
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };

    // Save to database (you'll need to create this table)
    try {
      const insertQuery = `
        INSERT INTO payment_orders (
          bog_order_id, external_order_id, amount, currency, description,
          customer_first_name, customer_last_name, customer_age,
          payment_url, callback_url, status, created_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *;
      `;

      const values = [
        paymentRecord.bog_order_id,
        paymentRecord.external_order_id,
        paymentRecord.amount,
        paymentRecord.currency,
        paymentRecord.description,
        paymentRecord.customer_first_name,
        paymentRecord.customer_last_name,
        paymentRecord.customer_age,
        paymentRecord.payment_url,
        paymentRecord.callback_url,
        paymentRecord.status,
        paymentRecord.created_at,
        paymentRecord.expires_at,
      ];

      const { rows } = await pool.query(insertQuery, values);
      console.log("💾 Payment record saved to database:", rows[0]);
    } catch (dbError) {
      console.error("❌ Database error:", dbError);
      // Continue anyway - payment can still work without database
    }

    // Return response
    res.status(201).json({
      success: true,
      order_id: bogOrderData.id,
      external_order_id,
      payment_url: bogOrderData._links.redirect.href,
      details_url: bogOrderData._links.details.href,
      amount: amount,
      currency: currency.toUpperCase(),
      status: "pending",
      expires_in_minutes: 30,
      created_at: paymentRecord.created_at,
      customer_data: customer_data,
    });
  } catch (error) {
    console.error("❌ Error creating BOG payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
