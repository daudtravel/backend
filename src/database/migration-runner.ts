import pool from "../config/sql";
import { createUsersTable } from "./migrations/001_create_user_table";
import { createToursTable } from "./migrations/002_create_tours_table";
import { createEmailVerificationTable } from "./migrations/003_create_email_verification_table";
import { createTransfersTable } from "./migrations/004_create_transfers_table";
import { createDriversTable } from "./migrations/005_create_drivers_table";
import { createFaqTable } from "./migrations/006_create_faq_table";
import { createVideosTable } from "./migrations/007_create_videos_table";
import { createPaymentOrdersTable } from "./migrations/008_create_payments_order_table";

interface Migration {
  id: string;
  query: string;
  description: string;
  expectedTables?: string[];
}

const migrations: Migration[] = [
  {
    id: "001_create_users_table",
    query: createUsersTable,
    description: "Create users table with indexes",
    expectedTables: ["users"],
  },
  {
    id: "002_create_tours_table",
    query: createToursTable,
    description: "Create tours table with indexes",
    expectedTables: ["tours"],
  },
  {
    id: "003_create_email_verification_table",
    query: createEmailVerificationTable,
    description: "Create email verification table",
    expectedTables: ["email_verification"],
  },
  {
    id: "004_create_transfers_table",
    query: createTransfersTable,
    description: "Create transfers table",
    expectedTables: ["transfers"],
  },
  {
    id: "005_create_drivers_table",
    query: createDriversTable,
    description: "Create drivers table",
    expectedTables: ["drivers"],
  },
  {
    id: "006_create_faq_table",
    query: createFaqTable,
    description: "Create FAQ table",
    expectedTables: ["faq"],
  },
  {
    id: "007_create_videos_table",
    query: createVideosTable,
    description: "Create videos table",
    expectedTables: ["videos"],
  },
  {
    id: "008_create_payment_orders_table",
    query: createPaymentOrdersTable,
    description: "Create payment orders table with indexes",
    expectedTables: ["payment_orders"],
  },
];

const createMigrationsTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS migrations (
      id VARCHAR(255) PRIMARY KEY,
      description TEXT,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      checksum VARCHAR(255)
    );
  `;
  try {
    await pool.query(query);
    console.log("✅ Migrations table created/verified");
  } catch (error) {
    console.error("❌ Error creating migrations table:", error);
    throw error;
  }
};

const isMigrationExecuted = async (migrationId: string): Promise<boolean> => {
  try {
    const result = await pool.query("SELECT id FROM migrations WHERE id = $1", [
      migrationId,
    ]);
    return result.rows.length > 0;
  } catch (error) {
    console.error(`❌ Error checking migration ${migrationId}:`, error);
    return false;
  }
};

const verifyTablesExist = async (tableNames: string[]): Promise<boolean> => {
  try {
    console.log(`🔍 Verifying tables: ${tableNames.join(", ")}`);

    // Add a small delay to ensure table creation is complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    for (const tableName of tableNames) {
      console.log(`  Checking table: ${tableName}`);

      const result = await pool.query(
        `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `,
        [tableName]
      );

      console.log(`  Table ${tableName} exists: ${result.rows[0].exists}`);

      if (!result.rows[0].exists) {
        console.log(`❌ Expected table '${tableName}' does not exist`);

        // Debug: List all existing tables
        const allTables = await pool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          ORDER BY table_name
        `);
        console.log(
          "📋 Existing tables:",
          allTables.rows.map((row) => row.table_name)
        );

        return false;
      }
    }
    return true;
  } catch (error) {
    console.error("❌ Error verifying tables:", error);
    return false;
  }
};

const runMigration = async (migration: Migration): Promise<void> => {
  const client = await pool.connect();
  console.log(`🚀 Running migration: ${migration.id}`);
  console.log(`📝 Description: ${migration.description}`);

  try {
    await client.query("BEGIN");

    // Log the SQL being executed for debugging
    console.log(`⚙️  Executing SQL for ${migration.id}...`);
    console.log(`📄 SQL Preview: ${migration.query.substring(0, 200)}...`);

    // Execute the migration query
    const result = await client.query(migration.query);
    console.log(
      `✅ SQL executed successfully. Rows affected: ${result.rowCount || 0}`
    );

    // Commit the transaction first
    await client.query("COMMIT");
    console.log(`✅ Transaction committed for ${migration.id}`);

    // Release the client before verification
    client.release();

    // Now verify expected tables were created using a fresh connection
    if (migration.expectedTables && migration.expectedTables.length > 0) {
      const tablesExist = await verifyTablesExist(migration.expectedTables);
      if (!tablesExist) {
        throw new Error(
          `Migration ${migration.id} completed but expected tables were not created`
        );
      }
      console.log(`✅ All expected tables verified for ${migration.id}`);
    }

    // Record the migration using pool (not the released client)
    await pool.query(
      "INSERT INTO migrations (id, description) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
      [migration.id, migration.description]
    );

    console.log(`✅ Migration ${migration.id} completed successfully\n`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`❌ Migration ${migration.id} failed:`, error);
    throw error;
  }
};

export const runMigrations = async (): Promise<void> => {
  console.log("🗃️  Starting database migrations...\n");

  try {
    // Test database connection first
    const testResult = await pool.query("SELECT NOW()");
    console.log("✅ Database connection verified");

    await createMigrationsTable();

    let executedCount = 0;
    let skippedCount = 0;

    for (const migration of migrations) {
      const isExecuted = await isMigrationExecuted(migration.id);

      if (!isExecuted) {
        await runMigration(migration);
        executedCount++;
      } else {
        console.log(
          `⏭️  Skipping migration ${migration.id} (already executed)`
        );

        // Still verify tables exist even for skipped migrations
        if (migration.expectedTables && migration.expectedTables.length > 0) {
          const tablesExist = await verifyTablesExist(migration.expectedTables);
          if (!tablesExist) {
            console.log(
              `⚠️  Warning: Migration ${migration.id} was marked as executed but expected tables are missing!`
            );
            console.log(`🔄 Re-running migration ${migration.id}...`);

            // Delete the migration record and re-run
            await pool.query("DELETE FROM migrations WHERE id = $1", [
              migration.id,
            ]);
            await runMigration(migration);
            executedCount++;
          }
        }
        skippedCount++;
      }
    }

    console.log("🎉 Migration process completed successfully!");
    console.log(
      `📊 Summary: ${executedCount} executed, ${skippedCount} skipped`
    );
  } catch (error) {
    console.error("💥 Migration process failed:", error);
    throw error;
  }
};

export const rollbackLastMigration = async (): Promise<void> => {
  try {
    const result = await pool.query(
      "SELECT id FROM migrations ORDER BY executed_at DESC LIMIT 1"
    );

    if (result.rows.length === 0) {
      console.log("No migrations to rollback");
      return;
    }

    const lastMigrationId = result.rows[0].id;
    console.log(`🔄 Rolling back migration: ${lastMigrationId}`);

    await pool.query("DELETE FROM migrations WHERE id = $1", [lastMigrationId]);
    console.log(`✅ Migration ${lastMigrationId} rolled back`);
  } catch (error) {
    console.error("❌ Rollback failed:", error);
    throw error;
  }
};

export const resetMigrations = async (): Promise<void> => {
  console.log("⚠️  WARNING: This will delete all migration records!");
  try {
    await pool.query("DELETE FROM migrations");
    console.log("✅ All migration records cleared");
  } catch (error) {
    console.error("❌ Failed to reset migrations:", error);
    throw error;
  }
};
