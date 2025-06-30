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
}

const migrations: Migration[] = [
  {
    id: "001_create_users_table",
    query: createUsersTable,
    description: "Create users table with indexes",
  },
  {
    id: "002_create_tours_table",
    query: createToursTable,
    description: "Create tours table with indexes",
  },
  {
    id: "003_create_email_verification_table",
    query: createEmailVerificationTable,
    description: "Create email verification table",
  },
  {
    id: "004_create_transfers_table",
    query: createTransfersTable,
    description: "Create transfers table",
  },
  {
    id: "005_create_drivers_table",
    query: createDriversTable,
    description: "Create drivers table",
  },
  {
    id: "006_create_faq_table",
    query: createFaqTable,
    description: "Create FAQ table",
  },
  {
    id: "007_create_videos_table",
    query: createVideosTable,
    description: "Create videos table",
  },
  {
    id: "008_create_payment_orders_table",
    query: createPaymentOrdersTable,
    description: "Create payment orders table with indexes",
  },
];

const createMigrationsTable = async (): Promise<void> => {
  const query = `
    CREATE TABLE IF NOT EXISTS migrations (
      id VARCHAR(255) PRIMARY KEY,
      description TEXT,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(query);
    console.log("Migrations table created/verified");
  } catch (error) {
    console.error("Error creating migrations table:", error);
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
    console.error(`Error checking migration ${migrationId}:`, error);
    return false;
  }
};

const runMigration = async (migration: Migration): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(migration.query);

    await client.query(
      "INSERT INTO migrations (id, description) VALUES ($1, $2)",
      [migration.id, migration.description]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const runMigrations = async (): Promise<void> => {
  try {
    await createMigrationsTable();
    for (const migration of migrations) {
      const isExecuted = await isMigrationExecuted(migration.id);

      if (!isExecuted) {
        await runMigration(migration);
      } else {
        console.log(
          `⏭️  Skipping migration ${migration.id} (already executed)`
        );
      }
    }

    console.log("🎉 All migrations completed successfully");
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

    await pool.query("DELETE FROM migrations WHERE id = $1", [lastMigrationId]);
  } catch (error) {
    throw error;
  }
};
