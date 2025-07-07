import pool from "../../config/sql";

export const cleanupExpiredPayments = async (): Promise<number> => {
  try {
    const functionExists = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'cleanup_expired_payment_orders'
      ) as exists;
    `);

    if (!functionExists.rows[0].exists) {
      await createCleanupFunction();
    }

    const result = await pool.query("SELECT cleanup_expired_payment_orders()");
    const deletedCount = result.rows[0].cleanup_expired_payment_orders;

    return deletedCount;
  } catch (error) {
    console.error("❌ Error cleaning up expired payment orders:", error);

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
  setTimeout(() => {
    cleanupExpiredPayments().catch(console.error);
  }, 5000);

  setInterval(
    () => {
      cleanupExpiredPayments().catch(console.error);
    },
    60 * 60 * 1000
  );
};
