import type { Request, Response } from "express";
import { getBOGAccessToken } from "./getBOGAccessToken";
import { BOG_API_URL, MOCK_MODE } from "./payments";
import { saveBookingAfterPayment } from "./handleBOGPayment";
import pool from "../../config/sql";
import { sendSuccessfulPurchaseEmail } from "../../mail/purchase";

export const handleBOGCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { order_id, external_order_id, status } = req.body;

    if (!order_id || !external_order_id) {
      res.status(400).json({
        success: false,
        message: "Missing required callback data",
      });
      return;
    }

    let paymentDetails;

    if (MOCK_MODE) {
      paymentDetails = {
        order_id: order_id,
        external_order_id: external_order_id,
        order_status: { key: "completed", value: "Completed" },
        payment_detail: {
          transaction_id: `mock_transaction_${Date.now()}`,
          transfer_method: { key: "card", value: "Card Payment" },
          code: "100",
          code_description: "Successful payment",
        },
      };
    } else {
      const accessToken = await getBOGAccessToken();

      const response = await fetch(`${BOG_API_URL}/receipt/${order_id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to get payment details: ${response.statusText}`
        );
      }

      paymentDetails = await response.json();
    }

    if (paymentDetails.order_status.key === "completed") {
      try {
        await saveBookingAfterPayment(external_order_id, paymentDetails);

        await sendSuccessEmailForOrder(external_order_id);
      } catch (error) {
        console.error(
          `❌ Error saving booking after successful payment:`,
          error
        );
      }
    } else {
      console.log(
        `❌ Payment not successful for order: ${external_order_id}, status: ${paymentDetails.order_status.key}`
      );
    }

    res.status(200).json({
      success: true,
      message: "Callback processed",
      order_id: order_id,
      external_order_id: external_order_id,
      status: paymentDetails.order_status.key,
    });
  } catch (error) {
    console.error("❌ Error processing BOG callback:", error);
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
          const cleaned = order.locations
            .replace(/^\[|\]$/g, "")
            .replace(/['"]+/g, "");
          locations = cleaned.split(",").map((loc: string) => loc.trim());
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
  } catch (error) {
    console.error("❌ Error sending success email:", error);
  }
};
