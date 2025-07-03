import type { Request, Response } from "express";
import { getBOGAccessToken } from "./getBOGAccessToken";
import { BOG_API_URL, MOCK_MODE } from "./payments";
import pool from "../../config/sql";

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

// Helper function to retry BOG API calls
const retryBOGApiCall = async (
  url: string,
  accessToken: string,
  maxRetries = 3,
  delay = 2000
) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 BOG API attempt ${attempt}/${maxRetries}: ${url}`);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ BOG API success on attempt ${attempt}`);
        return data;
      }

      if (response.status === 404 && attempt < maxRetries) {
        console.log(
          `⏳ BOG API returned 404, waiting ${delay}ms before retry ${
            attempt + 1
          }`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(
        `BOG API error: ${response.status} ${response.statusText}`
      );
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.log(
        `⚠️ BOG API attempt ${attempt} failed, retrying in ${delay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

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

    let paymentDetails: BOGPaymentDetails;

    if (MOCK_MODE) {
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
          items: [],
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
      try {
        const accessToken = await getBOGAccessToken();

        // Try with retry logic
        paymentDetails = await retryBOGApiCall(
          `${BOG_API_URL}/receipt/${order_id}`,
          accessToken,
          3, // 3 attempts
          3000 // 3 second delay
        );
      } catch (apiError) {
        console.error(
          "❌ BOG API failed after retries, checking database:",
          apiError
        );

        // Check if we have this order in our database (fallback processed)
        try {
          const dbQuery = `
            SELECT 
              external_order_id,
              bog_order_id,
              status,
              amount_paid,
              total_tour_price,
              payment_completed_at,
              transaction_id
            FROM payment_orders 
            WHERE bog_order_id = $1 OR external_order_id LIKE '%' || $1 || '%'
          `;

          const { rows } = await pool.query(dbQuery, [order_id]);

          if (rows.length > 0) {
            const dbOrder = rows[0];
            console.log("✅ Found order in database, returning success status");

            res.status(200).json({
              success: true,
              order_id: order_id,
              external_order_id: dbOrder.external_order_id,
              status: "completed",
              status_description: "Completed",
              is_actually_paid: true,
              amount: {
                requested: Number(dbOrder.total_tour_price),
                transferred: Number(dbOrder.amount_paid),
                refunded: 0,
                currency: "GEL",
              },
              payment_method: "card",
              payment_code: "100",
              payment_code_description: "Successful payment",
              transaction_id: dbOrder.transaction_id,
              created_at: dbOrder.payment_completed_at,
              source: "database_fallback",
            });
            return;
          }
        } catch (dbError) {
          console.error("❌ Database fallback failed:", dbError);
        }

        // If all else fails, return 404
        res.status(404).json({
          success: false,
          message: "Payment not found and could not verify with bank",
          order_id: order_id,
        });
        return;
      }
    }

    // Check if payment was actually completed and charged
    const isActuallyPaid =
      paymentDetails.order_status.key === "completed" &&
      paymentDetails.payment_detail?.code === "100" &&
      paymentDetails.purchase_units?.transfer_amount &&
      Number.parseFloat(paymentDetails.purchase_units.transfer_amount) > 0;

    res.status(200).json({
      success: true,
      order_id: paymentDetails.order_id,
      external_order_id: paymentDetails.external_order_id,
      status: paymentDetails.order_status.key,
      status_description: paymentDetails.order_status.value,
      is_actually_paid: isActuallyPaid,
      amount: {
        requested: Number.parseFloat(
          paymentDetails.purchase_units.request_amount
        ),
        transferred: Number.parseFloat(
          paymentDetails.purchase_units.transfer_amount
        ),
        refunded: Number.parseFloat(
          paymentDetails.purchase_units.refund_amount
        ),
        currency: paymentDetails.purchase_units.currency_code,
      },
      payment_method: paymentDetails.payment_detail?.transfer_method.key,
      payment_code: paymentDetails.payment_detail?.code,
      payment_code_description: paymentDetails.payment_detail?.code_description,
      transaction_id: paymentDetails.payment_detail?.transaction_id,
      created_at: paymentDetails.zoned_create_date,
      expires_at: paymentDetails.zoned_expire_date,
      buyer: paymentDetails.buyer,
      reject_reason: paymentDetails.reject_reason,
      full_details: paymentDetails,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get payment status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
