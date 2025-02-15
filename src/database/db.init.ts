
import pool from '../config/sql';

export const createToursTableIfNotExist = async (): Promise<void> => {
  const toursQuery = `
  CREATE TABLE IF NOT EXISTS tours (
    id UUID PRIMARY KEY,
    group_prices JSONB NOT NULL,
    individual_prices JSONB NOT NULL,
    localizations JSONB NOT NULL,
    duration VARCHAR(255) NOT NULL,
    public BOOLEAN DEFAULT false,
    type BOOLEAN DEFAULT false,
    image TEXT,
    gallery TEXT[] DEFAULT ARRAY[]::TEXT[],
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`;

  try {
    await pool.query(toursQuery);
    console.log("Tours table created");
  } catch (error) {
    console.error("Error creating tours table:", error);
    throw error;
  }
};

const createUsersTableIfNotExist = async () => {
  const userQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      firstname VARCHAR(255) NOT NULL,
      lastname VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      is_verified BOOLEAN DEFAULT FALSE,
      admin BOOLEAN DEFAULT false, 
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

const createTransfersTableIfNotExist = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS transfers (
      id UUID PRIMARY KEY,
      localizations JSONB NOT NULL,
      total_price INT NOT NULL,
      reservation_price INT NOT NULL,
      date DATE NOT NULL, 
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(query);
    console.log('Trasnfers  table checked/created successfully');
  } catch (error) {
    console.error('Error creating transfers table:', error);
  }
};

const createDriversTableIfNoExist = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS drivers (
      id UUID PRIMARY KEY,
      firstname VARCHAR(255) NOT NULL,
      lastname VARCHAR(255) NOT NULL,
      image TEXT
       
    );
  `;

  try {
    await pool.query(query);
    console.log('Drivers  table checked/created successfully');
  } catch (error) {
    console.error('Error creating transfers table:', error);
  }
};



export const initDatabase = async () => {
  await createUsersTableIfNotExist();
  await createEmailVerificationTableIfNotExist();
  await createToursTableIfNotExist();
  await createTransfersTableIfNotExist();
  await createDriversTableIfNoExist()
};
