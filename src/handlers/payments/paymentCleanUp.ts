import pool from "../../config/sql";

export const cleanupExpiredPayments = async (): Promise<number> => {
  try {
    // First, check if the function exists
    const functionExists = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'cleanup_expired_payment_orders'
      ) as exists;
    `);

    if (!functionExists.rows[0].exists) {
      console.log(
        "⚠️  cleanup_expired_payment_orders function not found, creating it..."
      );
      await createCleanupFunction();
    }

    const result = await pool.query("SELECT cleanup_expired_payment_orders()");
    const deletedCount = result.rows[0].cleanup_expired_payment_orders;

    if (deletedCount > 0) {
      console.log(`🧹 Cleaned up ${deletedCount} expired payment orders`);
    }

    return deletedCount;
  } catch (error) {
    console.error("❌ Error cleaning up expired payment orders:", error);

    // If function still doesn't exist, try manual cleanup

    throw error;
  }
};

const createCleanupFunction = async (): Promise<void> => {
  const functionSQL = `
    CREATE OR REPLACE FUNCTION cleanup_expired_payment_orders()
    RETURNS INTEGER AS $$
    DECLARE
      deleted_count INTEGER;
    BEGIN
      DELETE FROM payment_orders 
      WHERE (status = 'pending' OR status = 'failed')
        AND expires_at IS NOT NULL
        AND expires_at < CURRENT_TIMESTAMP;
        
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
        
      RAISE NOTICE 'Cleaned up % expired payment orders at %', deleted_count, CURRENT_TIMESTAMP;
        
      RETURN deleted_count;
    END;
    $$ LANGUAGE plpgsql;
  `;

  await pool.query(functionSQL);
  console.log("✅ cleanup_expired_payment_orders function created or updated");
};

const manualCleanup = async (): Promise<number> => {
  try {
    const result = await pool.query(`
      DELETE FROM payment_orders 
      WHERE (status = 'pending' OR status = 'failed')
        AND expires_at IS NOT NULL
        AND expires_at < CURRENT_TIMESTAMP
      RETURNING id;
    `);

    const deletedCount = result.rowCount || 0;

    if (deletedCount > 0) {
      console.log(
        `🧹 Manually cleaned up ${deletedCount} expired payment orders`
      );
    } else {
      console.log(
        "🧹 No expired failed or pending payment orders to clean up manually"
      );
    }

    return deletedCount;
  } catch (error) {
    console.error("❌ Manual cleanup failed:", error);
    return 0;
  }
};
export const startPaymentCleanup = (): void => {
  console.log("🕐 Starting automatic payment cleanup (every hour)");

  // Run immediately with a small delay to allow server to fully start
  setTimeout(() => {
    cleanupExpiredPayments().catch(console.error);
  }, 5000);

  // Then run every hour
  setInterval(
    () => {
      cleanupExpiredPayments().catch(console.error);
    },
    60 * 60 * 1000
  ); // 1 hour in milliseconds
};
