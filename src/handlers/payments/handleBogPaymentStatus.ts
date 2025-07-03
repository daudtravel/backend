import type { Request, Response } from "express";
import { getBOGAccessToken } from "./getBOGAccessToken";
import { BOG_API_URL, MOCK_MODE } from "./payments";
import pool from "../../config/sql";

interface BOGPaymentDetails {
  order_id: string;
  external_order_id: string;
  order_status: {
    key: string;
    value: string;
  };
  purchase_units: {
    request_amount: string;
    transfer_amount: string;
    refund_amount: string;
    currency_code: string;
  };
  payment_detail?: {
    transfer_method: {
      key: string;
      value: string;
    };
    transaction_id: string;
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

// Strict payment verification - only returns true if money was actually charged
const isPaymentActuallySuccessful = (
  paymentDetails: BOGPaymentDetails
): boolean => {
  return (
    paymentDetails.order_status?.key === "completed" &&
    paymentDetails.payment_detail?.code === "100" &&
    !!paymentDetails.purchase_units?.transfer_amount &&
    Number.parseFloat(paymentDetails.purchase_units.transfer_amount) > 0
  );
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

    // First, check if we have this order in our database (means it was successfully processed)
    try {
      const dbQuery = `
        SELECT 
          external_order_id,
          bog_order_id,
          status,
          amount_paid,
          total_tour_price,
          payment_completed_at,
          transaction_id,
          customer_first_name,
          customer_last_name,
          tour_name
        FROM payment_orders 
        WHERE bog_order_id = $1 OR external_order_id = $1
      `;

      const { rows } = await pool.query(dbQuery, [order_id]);

      if (rows.length > 0) {
        const dbOrder = rows[0];
        console.log("✅ Found completed order in database");

        res.status(200).json({
          success: true,
          order_id: order_id,
          external_order_id: dbOrder.external_order_id,
          status: "completed",
          status_description: "Payment completed successfully",
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
          completed_at: dbOrder.payment_completed_at,
          customer_name: `${dbOrder.customer_first_name} ${dbOrder.customer_last_name}`,
          tour_name: dbOrder.tour_name,
          source: "database",
        });
        return;
      }
    } catch (dbError) {
      console.error("❌ Database query failed:", dbError);
      // Continue to BOG API check
    }

    // If not in database, check BOG API
    let paymentDetails: BOGPaymentDetails;

    if (MOCK_MODE) {
      paymentDetails = {
        order_id: order_id,
        external_order_id: `ORDER_${order_id.split("_")[1] || "test"}`,
        order_status: {
          key: "completed",
          value: "Completed",
        },
        purchase_units: {
          request_amount: "10.00",
          transfer_amount: "10.00",
          refund_amount: "0.00",
          currency_code: "GEL",
        },
        payment_detail: {
          transfer_method: {
            key: "card",
            value: "Card Payment",
          },
          transaction_id: "mock_transaction_123",
          code: "100",
          code_description: "Successful payment",
        },
      };
    } else {
      try {
        const accessToken = await getBOGAccessToken();
        paymentDetails = await retryBOGApiCall(
          `${BOG_API_URL}/receipt/${order_id}`,
          accessToken,
          3,
          3000
        );
      } catch (apiError) {
        console.error("❌ BOG API failed after retries:", apiError);

        res.status(404).json({
          success: false,
          message: "Payment not found",
          order_id: order_id,
          note: "Payment not found in database and BOG API is unavailable",
        });
        return;
      }
    }

    // Check if payment is actually successful
    const isActuallyPaid = isPaymentActuallySuccessful(paymentDetails);

    // Only return success details if payment is actually completed and charged
    if (isActuallyPaid) {
      res.status(200).json({
        success: true,
        order_id: paymentDetails.order_id,
        external_order_id: paymentDetails.external_order_id,
        status: "completed",
        status_description: "Payment completed successfully",
        is_actually_paid: true,
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
        payment_code_description:
          paymentDetails.payment_detail?.code_description,
        transaction_id: paymentDetails.payment_detail?.transaction_id,
        source: "bog_api",
      });
    } else {
      // Payment exists but is not successful or not charged
      res.status(200).json({
        success: true,
        order_id: paymentDetails.order_id,
        external_order_id: paymentDetails.external_order_id,
        status: paymentDetails.order_status.key,
        status_description: paymentDetails.order_status.value,
        is_actually_paid: false,
        amount: {
          requested: Number.parseFloat(
            paymentDetails.purchase_units.request_amount
          ),
          transferred: Number.parseFloat(
            paymentDetails.purchase_units.transfer_amount || "0"
          ),
          refunded: Number.parseFloat(
            paymentDetails.purchase_units.refund_amount || "0"
          ),
          currency: paymentDetails.purchase_units.currency_code,
        },
        payment_method: paymentDetails.payment_detail?.transfer_method.key,
        payment_code: paymentDetails.payment_detail?.code,
        payment_code_description:
          paymentDetails.payment_detail?.code_description,
        reject_reason: paymentDetails.reject_reason,
        source: "bog_api",
        note: "Payment not successful or not charged",
      });
    }
  } catch (error) {
    console.error("❌ Error getting payment status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get payment status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
