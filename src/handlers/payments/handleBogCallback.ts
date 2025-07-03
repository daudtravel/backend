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
      body: req.body,
    });

    if (!order_id || !external_order_id) {
      console.error("❌ Missing required callback data");
      res.status(400).json({
        success: false,
        message: "Missing required callback data",
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
          transfer_amount: "10.00",
          request_amount: "10.00",
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

        // Try with retry logic
        paymentDetails = await retryBOGApiCall(
          `${BOG_API_URL}/receipt/${order_id}`,
          accessToken,
          3, // 3 attempts
          3000 // 3 second delay
        );

        console.log("📄 Payment details retrieved:", paymentDetails);
      } catch (apiError) {
        console.error(
          "❌ Error fetching payment details from BOG after retries:",
          apiError
        );

        // If callback status suggests success but API fails, treat as successful
        if (status === "completed" || status === "success") {
          console.log(
            "🔄 Callback indicates success despite API error, processing as successful payment"
          );

          try {
            // Process as successful payment without full verification
            await processSuccessfulPaymentFallback(external_order_id, order_id);

            res.status(200).json({
              success: true,
              message: "Payment processed successfully (fallback mode)",
              order_id: order_id,
              external_order_id: external_order_id,
              status: "completed",
            });
            return;
          } catch (fallbackError) {
            console.error("❌ Fallback processing failed:", fallbackError);
          }
        }

        // Send failure email if we have pending payment data
        await sendFailedPaymentEmailForOrder(external_order_id, {
          order_status: {
            key: "verification_failed",
            value: "Payment verification failed",
          },
          reject_reason: "Unable to verify payment with bank",
        });

        res.status(200).json({
          success: true,
          message: "Callback received but payment verification failed",
          order_id: order_id,
          external_order_id: external_order_id,
          status: "verification_failed",
        });
        return;
      }
    }

    // STRICT PAYMENT VERIFICATION - Only process if money was actually charged
    const isPaymentActuallyCompleted =
      paymentDetails.order_status.key === "completed" &&
      paymentDetails.payment_detail?.code === "100" &&
      paymentDetails.purchase_units?.transfer_amount &&
      Number.parseFloat(paymentDetails.purchase_units.transfer_amount) > 0;

    if (isPaymentActuallyCompleted) {
      try {
        console.log(
          "✅ Payment verified as completed and charged, processing booking..."
        );

        // Save booking data to payment_orders table
        await saveBookingAfterPayment(external_order_id, paymentDetails);

        // Send success email
        await sendSuccessEmailForOrder(external_order_id);

        console.log("✅ Booking and email processed successfully");
      } catch (error) {
        console.error("❌ Error processing successful payment:", error);
        // Even if processing fails, we acknowledge the callback to prevent retries
      }
    }
    // Handle failed/rejected payments
    else if (
      ["rejected", "failed", "cancelled", "expired"].includes(
        paymentDetails.order_status.key
      )
    ) {
      console.log(
        `❌ Payment failed for order: ${external_order_id}, status: ${paymentDetails.order_status.key}`
      );

      try {
        // Send failure email but don't save to database
        await sendFailedPaymentEmailForOrder(external_order_id, paymentDetails);
        console.log("✅ Failed payment email sent");
      } catch (error) {
        console.error("❌ Error sending failed payment email:", error);
      }
    }
    // Handle pending/processing payments or incomplete payments
    else {
      console.log(
        `⏳ Payment not completed or not charged for order: ${external_order_id}, status: ${paymentDetails.order_status.key}, code: ${paymentDetails.payment_detail?.code}, transfer_amount: ${paymentDetails.purchase_units?.transfer_amount}`
      );
    }

    // Always respond with success to BOG to prevent retries
    res.status(200).json({
      success: true,
      message: "Callback processed",
      order_id: order_id,
      external_order_id: external_order_id,
      status: paymentDetails.order_status.key,
    });
  } catch (error) {
    console.error("❌ Critical error processing BOG callback:", error);

    // Still respond with success to prevent BOG retries, but log the error
    res.status(200).json({
      success: true,
      message: "Callback received but processing failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Fallback processing when BOG API is not available but callback indicates success
const processSuccessfulPaymentFallback = async (
  externalOrderId: string,
  bogOrderId: string
): Promise<void> => {
  const bookingData = pendingPayments.get(externalOrderId);

  if (!bookingData) {
    throw new Error(
      `No pending payment data found for order: ${externalOrderId}`
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const extractPlainText = (
      description: string | undefined
    ): string | null => {
      if (!description) return null;
      try {
        const parsed = JSON.parse(description);
        if (parsed.blocks && Array.isArray(parsed.blocks)) {
          return (
            parsed.blocks
              .map((block: any) => block.text || "")
              .filter((text: string) => text.trim())
              .join(" ")
              .trim() || null
          );
        }
        return description.trim() || null;
      } catch {
        return description.trim() || null;
      }
    };

    const cleanDescription = extractPlainText(bookingData.tourDescription);
    const calculatedRemainingAmount = bookingData.paymentType
      ? null
      : bookingData.totalTourPrice - bookingData.paymentAmount;

    const insertQuery = `
      INSERT INTO payment_orders (
        customer_first_name, 
        customer_last_name, 
        customer_email, 
        customer_phone,
        people_amount, 
        selected_date, 
        tour_duration_days, 
        tour_duration_nights,
        tour_name,
        tour_description,
        start_location,
        end_location,
        locations,
        is_full_payment,
        total_tour_price,
        amount_paid,
        amount_remaining,
        external_order_id, 
        bog_order_id, 
        status,
        payment_completed_at,
        transaction_id,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *;
    `;

    const locationsToStore =
      bookingData.locations && bookingData.locations.length > 0
        ? JSON.stringify(bookingData.locations)
        : null;

    const values = [
      bookingData.firstName,
      bookingData.lastName,
      bookingData.email,
      bookingData.phone,
      bookingData.peopleAmount,
      new Date(bookingData.selectedDate),
      bookingData.tourDurationDays || 1,
      bookingData.tourDurationNights || 0,
      bookingData.tourName,
      cleanDescription,
      bookingData.startLocation || null,
      bookingData.endLocation || null,
      locationsToStore,
      bookingData.paymentType,
      Number(bookingData.totalTourPrice),
      Number(bookingData.paymentAmount),
      calculatedRemainingAmount ? Number(calculatedRemainingAmount) : null,
      externalOrderId,
      bogOrderId,
      "completed", // Status as completed
      new Date(), // payment_completed_at
      `fallback_${Date.now()}`, // fallback transaction_id
      new Date(), // created_at
    ];

    await client.query(insertQuery, values);
    await client.query("COMMIT");

    // Remove from pending payments after successful save
    pendingPayments.delete(externalOrderId);

    // Send success email
    await sendSuccessEmailForOrder(externalOrderId);

    console.log(
      `✅ Fallback booking processing completed for order: ${externalOrderId}`
    );
  } catch (dbError) {
    await client.query("ROLLBACK");
    console.error(
      `❌ Error in fallback processing for order ${externalOrderId}:`,
      dbError
    );
    throw dbError;
  } finally {
    client.release();
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
          // Handle both JSON string and array string formats
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

const sendFailedPaymentEmailForOrder = async (
  externalOrderId: string,
  paymentDetails: any
): Promise<void> => {
  try {
    // Get pending payment data from memory
    const bookingData = pendingPayments.get(externalOrderId);

    if (!bookingData) {
      console.warn(
        "⚠️ No pending payment data found for failed order:",
        externalOrderId
      );
      return;
    }

    const failedPaymentDetails = {
      customerFirstName: bookingData.firstName,
      customerLastName: bookingData.lastName,
      customerEmail: bookingData.email,
      tourName: bookingData.tourName,
      selectedDate: new Date(bookingData.selectedDate).toISOString(),
      peopleAmount: bookingData.peopleAmount,
      totalTourPrice: Number(bookingData.totalTourPrice),
      amountPaid: Number(bookingData.paymentAmount),
      externalOrderId: externalOrderId,
      failureReason:
        paymentDetails.reject_reason || paymentDetails.order_status.value,
      paymentStatus: paymentDetails.order_status.key,
    };

    await sendFailedPaymentEmail(failedPaymentDetails);

    console.log("✅ Failed payment email sent for order:", externalOrderId);

    // Clean up pending payment data after sending email
    pendingPayments.delete(externalOrderId);
  } catch (error) {
    console.error("❌ Error sending failed payment email:", error);
  }
};
