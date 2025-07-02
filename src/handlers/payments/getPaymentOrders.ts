import type { Request, Response } from "express";
import pool from "../../config/sql";

// Get all payment orders with pagination
export const getPaymentOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.max(
      1,
      Math.min(100, parseInt(limit as string) || 10)
    );
    const offset = (pageNum - 1) * limitNum;

    console.log("🔍 Fetching all payment orders:", {
      page: pageNum,
      limit: limitNum,
    });

    // Count total records
    const countQuery = `SELECT COUNT(*) as total FROM payment_orders`;
    const countResult = await pool.query(countQuery);
    const totalRecords = parseInt(countResult.rows[0].total);

    // Fetch paginated data
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
        external_order_id,
        bog_order_id,
        status,
        payment_url,
        expires_at,
        created_at,
        updated_at
      FROM payment_orders
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const { rows } = await pool.query(dataQuery, [limitNum, offset]);

    // Format each order
    const formattedOrders = rows.map((order) => {
      let locations: string[] | undefined;

      if (order.locations) {
        try {
          // If it's a string like "[ 'თბილისი', 'გუდაური' ]", clean it
          if (typeof order.locations === "string") {
            const cleaned = order.locations
              .replace(/^\[|\]$/g, "") // remove square brackets
              .replace(/['"]+/g, ""); // remove quotes
            locations = cleaned.split(",").map((loc: string) => loc.trim());
          }
          // If already an array (e.g. from PostgreSQL text[]), use as-is
          else if (Array.isArray(order.locations)) {
            locations = order.locations;
          }
        } catch (err) {
          console.warn("⚠️ Failed to process locations:", order.locations);
          locations = undefined;
        }
      }

      return {
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
        externalOrderId: order.external_order_id,
        bogOrderId: order.bog_order_id,
        status: order.status,
        paymentUrl: order.payment_url,
        expiresAt: order.expires_at?.toISOString(),
        createdAt: order.created_at.toISOString(),
        updatedAt: order.updated_at.toISOString(),
      };
    });

    const totalPages = Math.ceil(totalRecords / limitNum);

    console.log("✅ Payment orders retrieved:", {
      count: formattedOrders.length,
      total: totalRecords,
      page: pageNum,
      totalPages,
    });

    res.status(200).json({
      success: true,
      data: formattedOrders,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalRecords,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching payment orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment orders",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
