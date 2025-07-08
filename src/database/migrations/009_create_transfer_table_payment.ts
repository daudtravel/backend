export const createTransferPaymentOrdersTable = `
 

CREATE TABLE IF NOT EXISTS transfer_payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Customer Information
  customer_first_name VARCHAR(255) NOT NULL,
  customer_last_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  
  -- Transfer Details
  passenger_count INTEGER NOT NULL,
  transfer_date DATE NOT NULL,
  transfer_time TIMESTAMP WITH TIME ZONE NOT NULL,
  vehicle_type VARCHAR(50) NOT NULL,
  transfer_name VARCHAR(500) NOT NULL,
  start_location VARCHAR(255) NOT NULL,
  end_location VARCHAR(255) NOT NULL,
  
  -- Payment Information
  payment_amount DECIMAL(10,2) NOT NULL,
  
  -- Order Tracking
  external_order_id VARCHAR(255) UNIQUE NOT NULL,
  bog_order_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  
  -- Payment Processing
  transaction_id VARCHAR(255),
  payment_method VARCHAR(50) DEFAULT 'bog',
  payment_url VARCHAR(500),
  callback_data JSONB,
  
  -- Payment Status
  paid_amount DECIMAL(10,2),
  paid_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  refunded_amount DECIMAL(10,2),
  refunded_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT valid_transfer_payment_amounts CHECK (
    payment_amount > 0 AND 
    passenger_count > 0
  )
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transfer_payment_orders_email ON transfer_payment_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_transfer_payment_orders_status ON transfer_payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_transfer_payment_orders_external_order_id ON transfer_payment_orders(external_order_id);
CREATE INDEX IF NOT EXISTS idx_transfer_payment_orders_bog_order_id ON transfer_payment_orders(bog_order_id);
CREATE INDEX IF NOT EXISTS idx_transfer_payment_orders_created_at ON transfer_payment_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_transfer_payment_orders_transfer_date ON transfer_payment_orders(transfer_date);
CREATE INDEX IF NOT EXISTS idx_transfer_payment_orders_transaction_id ON transfer_payment_orders(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transfer_payment_orders_expires_at ON transfer_payment_orders(expires_at);

-- Trigger for updating updated_at column
CREATE OR REPLACE FUNCTION update_transfer_payment_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_transfer_payment_orders_updated_at ON transfer_payment_orders;
CREATE TRIGGER update_transfer_payment_orders_updated_at
  BEFORE UPDATE ON transfer_payment_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_transfer_payment_orders_updated_at();
`;
