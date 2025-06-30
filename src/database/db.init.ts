import { runMigrations } from "./migration-runner";

export const initDatabase = async (): Promise<void> => {
  try {
    await runMigrations();
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
};
