import type { Request, Response } from "express";
import { getBOGAccessToken } from "./getBOGAccessToken";
import { BOG_API_URL, MOCK_MODE } from "./payments";
import { saveBookingAfterPayment, pendingPayments } from "./handleBOGPayment";
import pool from "../../config/sql";
import {
  sendSuccessfulPurchaseEmail,
  sendFailedPaymentEmail,
} from "../../mail/purchase";

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
const isPaymentActuallySuccessful = (paymentDetails: any): boolean => {
  return (
    paymentDetails.order_status?.key === "completed" &&
    paymentDetails.payment_detail?.code === "100" &&
    paymentDetails.purchase_units?.transfer_amount &&
    Number.parseFloat(paymentDetails.purchase_units.transfer_amount) > 0
  );
};

export const handleBOGCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { order_id, external_order_id, status } = req.body;

    console.log("📥 BOG Callback received:", {
      order_id,
      external_order_id,
      status,
    });

    // Validate required callback data
    if (!order_id || !external_order_id) {
      console.error("❌ Missing required callback data");
      res.status(400).json({
        success: false,
        message: "Missing required callback data",
      });
      return;
    }

    // Check if we have pending payment data
    const bookingData = pendingPayments.get(external_order_id);
    if (!bookingData) {
      console.warn(
        `⚠️ No pending payment data found for order: ${external_order_id}`
      );
      res.status(200).json({
        success: true,
        message: "Order not found in pending payments",
        order_id: order_id,
        external_order_id: external_order_id,
        status: "unknown",
      });
      return;
    }

    let paymentDetails;

    if (MOCK_MODE) {
      // Mock successful payment for testing
      paymentDetails = {
        order_id: order_id,
        external_order_id: external_order_id,
        order_status: { key: "completed", value: "Completed" },
        purchase_units: {
          transfer_amount: bookingData.paymentAmount.toString(),
          request_amount: bookingData.paymentAmount.toString(),
          currency_code: "GEL",
        },
        payment_detail: {
          transaction_id: `mock_transaction_${Date.now()}`,
          transfer_method: { key: "card", value: "Card Payment" },
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

        console.log("📄 Payment details retrieved:", {
          order_id: paymentDetails.order_id,
          status: paymentDetails.order_status,
          transfer_amount: paymentDetails.purchase_units?.transfer_amount,
          code: paymentDetails.payment_detail?.code,
        });
      } catch (apiError) {
        console.error("❌ Error fetching payment details from BOG:", apiError);

        // Clean up pending payment and respond with error
        pendingPayments.delete(external_order_id);

        res.status(200).json({
          success: true,
          message: "Payment verification failed",
          order_id: order_id,
          external_order_id: external_order_id,
          status: "verification_failed",
        });
        return;
      }
    }

    // CRITICAL: Only process if payment is actually successful and money was charged
    if (isPaymentActuallySuccessful(paymentDetails)) {
      try {
        console.log(
          "✅ Payment verified as successful and charged, processing booking..."
        );

        // Save booking to database
        await saveBookingAfterPayment(external_order_id, paymentDetails);

        // Send success email
        await sendSuccessEmailForOrder(external_order_id);

        console.log("✅ Booking saved and success email sent");

        res.status(200).json({
          success: true,
          message: "Payment processed successfully",
          order_id: order_id,
          external_order_id: external_order_id,
          status: "completed",
        });
      } catch (error) {
        console.error("❌ Error processing successful payment:", error);

        // Even if processing fails, we acknowledge the callback to prevent retries
        res.status(200).json({
          success: true,
          message: "Payment confirmed but processing failed",
          order_id: order_id,
          external_order_id: external_order_id,
          status: "processing_failed",
        });
      }
    } else {
      // Payment was not successful or no money was charged
      console.log(`❌ Payment not successful for order: ${external_order_id}`, {
        status: paymentDetails.order_status?.key,
        code: paymentDetails.payment_detail?.code,
        transfer_amount: paymentDetails.purchase_units?.transfer_amount,
      });

      // Clean up pending payment - no database save, no email
      pendingPayments.delete(external_order_id);

      res.status(200).json({
        success: true,
        message: "Payment not successful",
        order_id: order_id,
        external_order_id: external_order_id,
        status: paymentDetails.order_status?.key || "failed",
      });
    }
  } catch (error) {
    console.error("❌ Critical error processing BOG callback:", error);

    // Always respond with success to prevent BOG retries
    res.status(200).json({
      success: true,
      message: "Callback received but processing failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

const sendSuccessEmailForOrder = async (
  externalOrderId: string
): Promise<void> => {
  try {
    const orderQuery = `
      SELECT 
        customer_first_name,
        customer_last_name,
        customer_email,
        tour_name,
        selected_date,
        people_amount,
        tour_duration_days,
        tour_duration_nights,
        start_location,
        end_location,
        locations,
        total_tour_price,
        amount_paid,
        amount_remaining,
        external_order_id,
        is_full_payment
      FROM payment_orders
      WHERE external_order_id = $1
    `;

    const { rows } = await pool.query(orderQuery, [externalOrderId]);

    if (rows.length === 0) {
      throw new Error(
        `Order not found for external_order_id: ${externalOrderId}`
      );
    }

    const order = rows[0];

    let locations: string[] | undefined;
    if (order.locations) {
      try {
        if (typeof order.locations === "string") {
          if (order.locations.startsWith("[")) {
            locations = JSON.parse(order.locations);
          } else {
            const cleaned = order.locations
              .replace(/^\[|\]$/g, "")
              .replace(/['"]+/g, "");
            locations = cleaned.split(",").map((loc: string) => loc.trim());
          }
        } else if (Array.isArray(order.locations)) {
          locations = order.locations;
        }
      } catch (err) {
        console.warn("⚠️ Failed to process locations:", order.locations);
        locations = undefined;
      }
    }

    const bookingDetails = {
      customerFirstName: order.customer_first_name,
      customerLastName: order.customer_last_name,
      customerEmail: order.customer_email,
      tourName: order.tour_name,
      selectedDate: order.selected_date?.toISOString(),
      peopleAmount: order.people_amount,
      tourDurationDays: order.tour_duration_days,
      tourDurationNights: order.tour_duration_nights,
      startLocation: order.start_location,
      endLocation: order.end_location,
      locations,
      totalTourPrice: Number(order.total_tour_price),
      amountPaid: Number(order.amount_paid),
      amountRemaining: order.amount_remaining
        ? Number(order.amount_remaining)
        : undefined,
      externalOrderId: order.external_order_id,
      isFullPayment: order.is_full_payment,
    };

    await sendSuccessfulPurchaseEmail(bookingDetails);
    console.log("✅ Success email sent for order:", externalOrderId);
  } catch (error) {
    console.error("❌ Error sending success email:", error);
    throw error;
  }
};
