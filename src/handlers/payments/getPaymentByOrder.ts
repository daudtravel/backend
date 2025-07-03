import type { Request, Response } from "express";
import pool from "../../config/sql";

export const getPaymentOrderById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
      return;
    }

    console.log("🔍 Fetching payment order by ID:", id);

    const dataQuery = `
      SELECT 
        id,
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
        status,
        created_at
      FROM payment_orders
      WHERE id = $1
    `;

    const { rows } = await pool.query(dataQuery, [id]);

    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    const order = rows[0];

    // Process locations similar to the getPaymentOrder function
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

    const formattedOrder = {
      id: order.id,
      customerFirstName: order.customer_first_name,
      customerLastName: order.customer_last_name,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      peopleAmount: order.people_amount,
      selectedDate: order.selected_date?.toISOString(),
      tourDurationDays: order.tour_duration_days,
      tourDurationNights: order.tour_duration_nights,
      tourName: order.tour_name,
      tourDescription: order.tour_description,
      startLocation: order.start_location,
      endLocation: order.end_location,
      locations,
      isFullPayment: order.is_full_payment,
      totalTourPrice: Number(order.total_tour_price),
      amountPaid: Number(order.amount_paid),
      amountRemaining: order.amount_remaining
        ? Number(order.amount_remaining)
        : undefined,
      status: order.status,
      createdAt: order.created_at.toISOString(),
    };

    res.status(200).json({
      success: true,
      data: formattedOrder,
    });
  } catch (error) {
    console.error("❌ Error fetching payment order by ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment order",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
