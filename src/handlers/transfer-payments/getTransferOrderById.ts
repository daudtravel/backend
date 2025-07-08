import type { Request, Response } from "express";
import pool from "../../config/sql";

export const getTransferOrderById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      res.status(400).json({
        success: false,
        message: "Invalid or missing transfer order ID",
      });
      return;
    }

    const query = `
      SELECT 
        id,
        customer_first_name,
        customer_last_name,
        customer_email,
        customer_phone,
        passenger_count,
        transfer_date,
        transfer_time,
        vehicle_type,
        transfer_name,
        start_location,
        end_location,
        payment_amount,
        external_order_id,
        bog_order_id,
        status,
        payment_url,
        expires_at,
        created_at,
        updated_at
      FROM transfer_payment_orders
      WHERE id = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Transfer order not found",
      });
      return;
    }

    const order = result.rows[0];

    const transformedOrder = {
      id: order.id,
      externalOrderId: order.external_order_id,
      bogOrderId: order.bog_order_id,
      status: order.status,
      paymentAmount: Number(order.payment_amount),
      currency: "GEL",
      paymentUrl: order.payment_url,
      expiresAt: order.expires_at?.toISOString(),
      createdAt: order.created_at.toISOString(),
      updatedAt: order.updated_at?.toISOString(),
      customer: {
        firstName: order.customer_first_name,
        lastName: order.customer_last_name,
        fullName: `${order.customer_first_name} ${order.customer_last_name}`,
        email: order.customer_email,
        phone: order.customer_phone,
      },
      transfer: {
        name: order.transfer_name,
        date: order.transfer_date.toISOString(),
        time: order.transfer_time.toISOString(),
        vehicleType: order.vehicle_type,
        passengerCount: order.passenger_count,
        startLocation: order.start_location,
        endLocation: order.end_location,
        route: `${order.start_location} → ${order.end_location}`,
      },
    };

    res.status(200).json({
      success: true,
      data: transformedOrder,
    });
  } catch (error) {
    console.error("Get Transfer Order By ID Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transfer order",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
