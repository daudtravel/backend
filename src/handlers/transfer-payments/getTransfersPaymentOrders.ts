import type { Request, Response } from "express";
import pool from "../../config/sql";

interface TransferOrder {
  id: number;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  passenger_count: number;
  transfer_date: Date;
  transfer_time: Date;
  vehicle_type: string;
  transfer_name: string;
  start_location: string;
  end_location: string;
  payment_amount: number;
  external_order_id: string;
  bog_order_id: string;
  status: string;
  payment_url: string;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

interface GetAllTransfersQuery {
  page?: string;
  limit?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export const getAllTransferOrders = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      page = "1",
      limit = "10",
      status,
      sortBy = "created_at",
      sortOrder = "desc",
    }: GetAllTransfersQuery = req.query;

    // Validation
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      res.status(400).json({
        success: false,
        message: "Page must be a positive integer",
      });
      return;
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      res.status(400).json({
        success: false,
        message: "Limit must be a positive integer between 1 and 100",
      });
      return;
    }

    // Valid sort columns
    const validSortColumns = [
      "created_at",
      "updated_at",
      "transfer_date",
      "transfer_time",
      "payment_amount",
      "status",
    ];

    if (!validSortColumns.includes(sortBy)) {
      res.status(400).json({
        success: false,
        message: `Invalid sortBy field. Valid options: ${validSortColumns.join(", ")}`,
      });
      return;
    }

    if (!["asc", "desc"].includes(sortOrder)) {
      res.status(400).json({
        success: false,
        message: "sortOrder must be 'asc' or 'desc'",
      });
      return;
    }

    const offset = (pageNum - 1) * limitNum;

    // Build query with optional status filter
    let whereClause = "";
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause = `WHERE status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM transfer_payment_orders
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, queryParams);
    const totalRecords = parseInt(countResult.rows[0].total);

    // Main query
    const selectQuery = `
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
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limitNum, offset);

    const result = await pool.query(selectQuery, queryParams);
    const orders: TransferOrder[] = result.rows;

    // Transform data for response
    const transformedOrders = orders.map((order) => ({
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
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(totalRecords / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.status(200).json({
      success: true,
      data: transformedOrders,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalRecords,
        recordsPerPage: limitNum,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? pageNum + 1 : null,
        prevPage: hasPrevPage ? pageNum - 1 : null,
      },
      filters: {
        status: status || null,
        sortBy,
        sortOrder,
      },
    });
  } catch (error) {
    console.error("Get All Transfer Orders Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transfer orders",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
