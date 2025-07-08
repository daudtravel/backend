import type { Request, Response } from "express";
import pool from "../../config/sql";

interface CleanupResult {
  success: boolean;
  message: string;
  deletedCount?: number;
  deletedOrders?: Array<{
    id: string;
    external_order_id: string;
    customer_email: string;
    created_at: string;
    rejection_reason?: string;
  }>;
  error?: string;
}

export const deleteFailedOrders = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const selectQuery = `
      SELECT 
        id,
        external_order_id,
        customer_email,
        created_at,
        rejection_reason,
        status
      FROM payment_orders 
      WHERE status = 'failed'
      ORDER BY created_at DESC;
    `;

    const selectResult = await pool.query(selectQuery);
    const failedOrders = selectResult.rows;

    if (failedOrders.length === 0) {
      res.status(200).json({
        success: true,
        message: "No failed orders found to delete",
        deletedCount: 0,
        deletedOrders: [],
      } as CleanupResult);
      return;
    }

    const deleteQuery = `
      DELETE FROM payment_orders 
      WHERE status = 'failed'
      RETURNING id, external_order_id;
    `;

    const deleteResult = await pool.query(deleteQuery);
    const deletedCount = deleteResult.rowCount || 0;

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${deletedCount} failed payment orders`,
      deletedCount,
      deletedOrders: failedOrders.map((order) => ({
        id: order.id,
        external_order_id: order.external_order_id,
        customer_email: order.customer_email,
        created_at: order.created_at,
        rejection_reason: order.rejection_reason,
      })),
    } as CleanupResult);
  } catch (error) {
    console.error("❌ Error deleting failed orders:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete failed orders",
      error: error instanceof Error ? error.message : "Unknown error",
    } as CleanupResult);
  }
};
