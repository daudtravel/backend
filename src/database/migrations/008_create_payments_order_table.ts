// SQL Table Creation
export const createPaymentOrdersTable = `
-- Drop existing table if you want to recreate (be careful with production data!)
-- DROP TABLE IF EXISTS payment_orders CASCADE;

CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  customer_first_name VARCHAR(255) NOT NULL,
  customer_last_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  
  people_amount INTEGER NOT NULL,
  selected_date DATE NOT NULL,
  tour_duration_days INTEGER DEFAULT 1,
  tour_duration_nights INTEGER DEFAULT 0,
  
  tour_name VARCHAR(500) NOT NULL,
  tour_description TEXT,
  start_location VARCHAR(255),
  end_location VARCHAR(255),
  locations JSONB,
  
  is_full_payment BOOLEAN NOT NULL,
  total_tour_price DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL,
  amount_remaining DECIMAL(10,2),
  
  external_order_id VARCHAR(255) UNIQUE NOT NULL,
  bog_order_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  
  transaction_id VARCHAR(255),
  payment_method VARCHAR(50) DEFAULT 'bog',
  payment_url VARCHAR(500),
  callback_data JSONB,
  
  paid_amount DECIMAL(10,2),
  paid_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  refunded_amount DECIMAL(10,2),
  refunded_at TIMESTAMP WITH TIME ZONE,
  
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

CREATE INDEX IF NOT EXISTS idx_payment_orders_email ON payment_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_external_order_id ON payment_orders(external_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_bog_order_id ON payment_orders(bog_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_orders_selected_date ON payment_orders(selected_date);
CREATE INDEX IF NOT EXISTS idx_payment_orders_transaction_id ON payment_orders(transaction_id);

-- Add index for expires_at to make cleanup faster
CREATE INDEX IF NOT EXISTS idx_payment_orders_expires_at ON payment_orders(expires_at);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_payment_orders_updated_at ON payment_orders;
CREATE TRIGGER update_payment_orders_updated_at
  BEFORE UPDATE ON payment_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add cleanup function for expired payment orders
CREATE OR REPLACE FUNCTION cleanup_expired_payment_orders()
RETURNS INTEGER AS $
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete orders that are pending and past their expiration time
  DELETE FROM payment_orders 
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < CURRENT_TIMESTAMP;
    
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
  -- Log the cleanup
  RAISE NOTICE 'Cleaned up % expired payment orders at %', deleted_count, CURRENT_TIMESTAMP;
    
  RETURN deleted_count;
END;
$ LANGUAGE plpgsql;
`;