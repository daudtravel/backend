import type { Request, Response } from "express";
import pool from "../../config/sql";

interface TransferCleanupResult {
  success: boolean;
  message: string;
  deletedCount?: number;
  deletedOrders?: Array<{
    id: string;
    external_order_id: string;
    customer_email: string;
    transfer_name: string;
    transfer_date: string;
    start_location: string;
    end_location: string;
    created_at: string;
    rejection_reason?: string;
  }>;
  error?: string;
}

export const deleteFailedTransferOrders = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const selectQuery = `
      SELECT 
        id,
        external_order_id,
        customer_email,
        transfer_name,
        transfer_date,
        start_location,
        end_location,
        created_at,
        rejection_reason,
        status
      FROM transfer_payment_orders 
      WHERE status = 'failed'
      ORDER BY created_at DESC;
    `;

    const selectResult = await pool.query(selectQuery);
    const failedTransferOrders = selectResult.rows;

    if (failedTransferOrders.length === 0) {
      res.status(200).json({
        success: true,
        message: "No failed transfer orders found to delete",
        deletedCount: 0,
        deletedOrders: [],
      } as TransferCleanupResult);
      return;
    }

    const deleteQuery = `
      DELETE FROM transfer_payment_orders 
      WHERE status = 'failed'
      RETURNING id, external_order_id;
    `;

    const deleteResult = await pool.query(deleteQuery);
    const deletedCount = deleteResult.rowCount || 0;

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${deletedCount} failed transfer payment orders`,
      deletedCount,
      deletedOrders: failedTransferOrders.map((order) => ({
        id: order.id,
        external_order_id: order.external_order_id,
        customer_email: order.customer_email,
        transfer_name: order.transfer_name,
        transfer_date: order.transfer_date,
        start_location: order.start_location,
        end_location: order.end_location,
        created_at: order.created_at,
        rejection_reason: order.rejection_reason,
      })),
    } as TransferCleanupResult);
  } catch (error) {
    console.error("❌ Error deleting failed transfer orders:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete failed transfer orders",
      error: error instanceof Error ? error.message : "Unknown error",
    } as TransferCleanupResult);
  }
};

// Optional: Cleanup expired transfer orders (pending orders that have expired)
export const deleteExpiredTransferOrders = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const selectQuery = `
      SELECT 
        id,
        external_order_id,
        customer_email,
        transfer_name,
        transfer_date,
        start_location,
        end_location,
        created_at,
        expires_at,
        status
      FROM transfer_payment_orders 
      WHERE status = 'pending' AND expires_at < CURRENT_TIMESTAMP
      ORDER BY created_at DESC;
    `;

    const selectResult = await pool.query(selectQuery);
    const expiredTransferOrders = selectResult.rows;

    if (expiredTransferOrders.length === 0) {
      res.status(200).json({
        success: true,
        message: "No expired transfer orders found to delete",
        deletedCount: 0,
        deletedOrders: [],
      } as TransferCleanupResult);
      return;
    }

    const deleteQuery = `
      DELETE FROM transfer_payment_orders 
      WHERE status = 'pending' AND expires_at < CURRENT_TIMESTAMP
      RETURNING id, external_order_id;
    `;

    const deleteResult = await pool.query(deleteQuery);
    const deletedCount = deleteResult.rowCount || 0;

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${deletedCount} expired transfer payment orders`,
      deletedCount,
      deletedOrders: expiredTransferOrders.map((order) => ({
        id: order.id,
        external_order_id: order.external_order_id,
        customer_email: order.customer_email,
        transfer_name: order.transfer_name,
        transfer_date: order.transfer_date,
        start_location: order.start_location,
        end_location: order.end_location,
        created_at: order.created_at,
        rejection_reason: "Order expired",
      })),
    } as TransferCleanupResult);
  } catch (error) {
    console.error("❌ Error deleting expired transfer orders:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete expired transfer orders",
      error: error instanceof Error ? error.message : "Unknown error",
    } as TransferCleanupResult);
  }
};

// Combined cleanup function for both failed and expired orders
export const cleanupTransferOrders = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get failed orders
    const failedQuery = `
      SELECT 
        id, external_order_id, customer_email, transfer_name, transfer_date,
        start_location, end_location, created_at, rejection_reason, 'failed' as cleanup_reason
      FROM transfer_payment_orders 
      WHERE status = 'failed'
      ORDER BY created_at DESC;
    `;

    // Get expired orders
    const expiredQuery = `
      SELECT 
        id, external_order_id, customer_email, transfer_name, transfer_date,
        start_location, end_location, created_at, 'expired' as rejection_reason, 'expired' as cleanup_reason
      FROM transfer_payment_orders 
      WHERE status = 'pending' AND expires_at < CURRENT_TIMESTAMP
      ORDER BY created_at DESC;
    `;

    const [failedResult, expiredResult] = await Promise.all([
      pool.query(failedQuery),
      pool.query(expiredQuery),
    ]);

    const failedOrders = failedResult.rows;
    const expiredOrders = expiredResult.rows;
    const allOrdersToDelete = [...failedOrders, ...expiredOrders];

    if (allOrdersToDelete.length === 0) {
      res.status(200).json({
        success: true,
        message: "No failed or expired transfer orders found to delete",
        deletedCount: 0,
        deletedOrders: [],
      } as TransferCleanupResult);
      return;
    }

    // Delete failed orders
    const deleteFailedQuery = `
      DELETE FROM transfer_payment_orders 
      WHERE status = 'failed'
      RETURNING id, external_order_id;
    `;

    // Delete expired orders
    const deleteExpiredQuery = `
      DELETE FROM transfer_payment_orders 
      WHERE status = 'pending' AND expires_at < CURRENT_TIMESTAMP
      RETURNING id, external_order_id;
    `;

    const [deleteFailedResult, deleteExpiredResult] = await Promise.all([
      pool.query(deleteFailedQuery),
      pool.query(deleteExpiredQuery),
    ]);

    const totalDeletedCount =
      (deleteFailedResult.rowCount || 0) + (deleteExpiredResult.rowCount || 0);

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${totalDeletedCount} transfer orders (${deleteFailedResult.rowCount || 0} failed, ${deleteExpiredResult.rowCount || 0} expired)`,
      deletedCount: totalDeletedCount,
      deletedOrders: allOrdersToDelete.map((order) => ({
        id: order.id,
        external_order_id: order.external_order_id,
        customer_email: order.customer_email,
        transfer_name: order.transfer_name,
        transfer_date: order.transfer_date,
        start_location: order.start_location,
        end_location: order.end_location,
        created_at: order.created_at,
        rejection_reason: order.rejection_reason,
      })),
    } as TransferCleanupResult);
  } catch (error) {
    console.error("❌ Error in transfer orders cleanup:", error);

    res.status(500).json({
      success: false,
      message: "Failed to cleanup transfer orders",
      error: error instanceof Error ? error.message : "Unknown error",
    } as TransferCleanupResult);
  }
};
