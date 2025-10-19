// SQL Table Creation
export const createPaymentOrdersTable = `
-- Drop existing table if you want to recreate (be careful with production data!)
-- DROP TABLE IF EXISTS payment_orders CASCADE;

CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Customer Information
  customer_first_name VARCHAR(255) NOT NULL,
  customer_last_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  
  -- Booking Details
  people_amount INTEGER NOT NULL,
  selected_date DATE NOT NULL,
  tour_duration_days INTEGER DEFAULT 1,
  tour_duration_nights INTEGER DEFAULT 0,
  
  -- Tour Information
  tour_name VARCHAR(500) NOT NULL,
  tour_description TEXT,
  start_location VARCHAR(255),
  end_location VARCHAR(255),
  locations JSONB,
  
  -- Payment Amounts
  is_full_payment BOOLEAN NOT NULL,
  total_tour_price DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL,
  amount_remaining DECIMAL(10,2),
  
  -- Order IDs
  external_order_id VARCHAR(255) UNIQUE NOT NULL,
  bog_order_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  
  -- Payment Transaction Details
  transaction_id VARCHAR(255),
  payment_method VARCHAR(50) DEFAULT 'bog',
  payment_url VARCHAR(500),
  callback_data JSONB,
  
  -- Payment Status & Response
  paid_amount DECIMAL(10,2),
  paid_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  payment_response_code VARCHAR(10),  -- ✅ ADDED: BOG response code (100=success, 107=insufficient funds, etc.)
  refunded_amount DECIMAL(10,2),
  refunded_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_payment_amounts CHECK (
    amount_paid > 0 AND 
    total_tour_price > 0 AND
    amount_paid <= total_tour_price AND
    (is_full_payment = true OR amount_remaining > 0)
  )
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_orders_email ON payment_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_external_order_id ON payment_orders(external_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_bog_order_id ON payment_orders(bog_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_orders_selected_date ON payment_orders(selected_date);
CREATE INDEX IF NOT EXISTS idx_payment_orders_transaction_id ON payment_orders(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_expires_at ON payment_orders(expires_at);
CREATE INDEX IF NOT EXISTS idx_payment_orders_response_code ON payment_orders(payment_response_code);  -- ✅ ADDED: Index for payment response codes

-- Add column comment for documentation
COMMENT ON COLUMN payment_orders.payment_response_code IS 
'BOG payment response code - 100: Success, 107: Insufficient funds, 108: Card declined, etc.';

-- Trigger for updating updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_payment_orders_updated_at ON payment_orders;
CREATE TRIGGER update_payment_orders_updated_at
  BEFORE UPDATE ON payment_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
`;
