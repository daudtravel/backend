
import pool from '../config/sql';

export const createToursTableIfNotExist = async (): Promise<void> => {
  const toursQuery = `
    CREATE TABLE IF NOT EXISTS tours (
      id UUID PRIMARY KEY,
      total_price DECIMAL(10, 2) NOT NULL,
      reservation_price DECIMAL(10, 2) NOT NULL,
      localizations JSONB NOT NULL,
      duration DECIMAL(10, 2) NOT NULL,
      image_url TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  try {
    await pool.query(toursQuery);
    console.log('Tours table checked/created successfully');
  } catch (error) {
    console.error('Error creating tours table:', error);
    throw error; // Propagate the error to handle it at a higher level
  }
};

const createTableIfNotExist = async () => {
  const userQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      firstname VARCHAR(255) NOT NULL,
      lastname VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      is_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(userQuery);
    console.log("User table checked/created successfully");
  } catch (error) {
    console.error("Error creating users table:", error);
  }
};

const createEmailVerificationTableIfNotExist = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS email_verification (
      email VARCHAR(100) PRIMARY KEY,
      code VARCHAR(6) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(query);
    console.log('Email verification table checked/created successfully');
  } catch (error) {
    console.error('Error creating email verification table:', error);
  }
};

export const initDatabase = async () => {
  await createTableIfNotExist();
  await createEmailVerificationTableIfNotExist();
  await createToursTableIfNotExist();
};
