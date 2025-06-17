import pool from "../config/sql"

const createToursTableIfNotExist = async (): Promise<void> => {
  const toursQuery = `
  CREATE TABLE IF NOT EXISTS tours (
    id UUID PRIMARY KEY,
    group_prices JSONB DEFAULT '{}'::jsonb,
    individual_prices JSONB DEFAULT '{}'::jsonb,
    localizations JSONB NOT NULL,
    day VARCHAR(255) NOT NULL,
    night VARCHAR(255) NOT NULL,
    public BOOLEAN DEFAULT false,
    type BOOLEAN DEFAULT false,
    daily BOOLEAN DEFAULT false, 
    image TEXT,
    gallery TEXT[] DEFAULT ARRAY[]::TEXT[],
    date DATE,
    amount_persons INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`

  try {
    await pool.query(toursQuery)
    console.log("Tours table created")
  } catch (error) {
    console.error("Error creating tours table:", error)
    throw error
  }
}

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
  `

  try {
    await pool.query(userQuery)
    console.log("User table checked/created successfully")
  } catch (error) {
    console.error("Error creating users table:", error)
  }
}

const createEmailVerificationTableIfNotExist = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS email_verification (
      email VARCHAR(100) PRIMARY KEY,
      code VARCHAR(6) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `

  try {
    await pool.query(query)
    console.log("Email verification table checked/created successfully")
  } catch (error) {
    console.error("Error creating email verification table:", error)
  }
}

const createTransfersTableIfNotExist = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS transfers (
      id UUID PRIMARY KEY,
      localizations JSONB NOT NULL,
      prices JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `

  try {
    await pool.query(query)
    console.log("Transfers table checked/created successfully")
  } catch (error) {
    console.error("Error creating transfers table:", error)
  }
}

const createDriversTableIfNoExist = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS drivers (
      id UUID PRIMARY KEY,
      firstname VARCHAR(255) NOT NULL,
      lastname VARCHAR(255) NOT NULL,
      image TEXT
    );
  `

  try {
    await pool.query(query)
    console.log("Drivers table checked/created successfully")
  } catch (error) {
    console.error("Error creating drivers table:", error)
  }
}

const createFaqTableIfNoExist = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS faq (
      id UUID PRIMARY KEY,
      localizations JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `

  try {
    await pool.query(query)
    console.log("FAQ table checked/created successfully")
  } catch (error) {
    console.error("Error creating faq table:", error)
  }
}

const createVideosTableIfNoExist = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS videos (
      id UUID PRIMARY KEY,
      youtube_link TEXT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `

  try {
    await pool.query(query)
    console.log("Videos table checked/created successfully")
  } catch (error) {
    console.error("Error creating videos table:", error)
  }
}

const createPaymentsTableIfNoExist = async () => {
  const query = `
   CREATE TABLE IF NOT EXISTS payment_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(255) UNIQUE NOT NULL, -- BOG order ID
    external_order_id VARCHAR(255) NOT NULL, -- Your internal order ID
    customer_email VARCHAR(255), -- Optional customer email
    customer_name VARCHAR(255), -- Optional customer name
    customer_phone VARCHAR(255), -- Optional customer phone
    total_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'GEL',
    status VARCHAR(50) DEFAULT 'pending', -- pending, success, failed, cancelled
    items JSONB NOT NULL, -- Store basket items as JSON
    callback_data JSONB, -- Store full callback data from BOG
    redirect_url TEXT, -- Payment page URL
    booking_metadata JSONB, -- Store tour booking details and other metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
  `

  try {
    await pool.query(query)
    console.log("Payments table checked/created successfully")
  } catch (error) {
    console.error("Error creating payments table:", error)
  }
}

const updatePaymentsTableIfNeeded = async () => {
  try {
    // Add booking_metadata column if it doesn't exist
    const addColumnQuery = `
      ALTER TABLE payment_orders 
      ADD COLUMN IF NOT EXISTS booking_metadata JSONB;
    `
    await pool.query(addColumnQuery)
    console.log("Booking metadata column added/checked successfully")

    // Create index for faster queries on booking metadata
    const createGinIndexQuery = `
      CREATE INDEX IF NOT EXISTS idx_payment_orders_booking_metadata 
      ON payment_orders USING GIN (booking_metadata);
    `
    await pool.query(createGinIndexQuery)
    console.log("GIN index on booking_metadata created/checked successfully")

    // Create index for tour bookings specifically
    const createTourIndexQuery = `
      CREATE INDEX IF NOT EXISTS idx_payment_orders_tour_bookings 
      ON payment_orders ((booking_metadata->>'booking_type')) 
      WHERE booking_metadata->>'booking_type' = 'tour';
    `
    await pool.query(createTourIndexQuery)
    console.log("Tour bookings index created/checked successfully")
  } catch (error) {
    console.error("Error updating payments table:", error)
  }
}

export const initDatabase = async () => {
  await createUsersTableIfNotExist()
  await createEmailVerificationTableIfNotExist()
  await createToursTableIfNotExist()
  await createTransfersTableIfNotExist()
  await createDriversTableIfNoExist()
  await createFaqTableIfNoExist()
  await createVideosTableIfNoExist()
  await createPaymentsTableIfNoExist()
  await updatePaymentsTableIfNeeded() // Add this line
}
