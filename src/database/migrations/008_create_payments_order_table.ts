export const createPaymentOrdersTable = `
  CREATE TABLE IF NOT EXISTS payment_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(255) UNIQUE NOT NULL,
    external_order_id VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(255),
    total_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'GEL',
    status VARCHAR(50) DEFAULT 'pending',
    items JSONB NOT NULL,
    callback_data JSONB,
    redirect_url TEXT,
    booking_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
  CREATE INDEX IF NOT EXISTS idx_payment_orders_customer_email ON payment_orders(customer_email);
  CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders(created_at);
  CREATE INDEX IF NOT EXISTS idx_payment_orders_booking_metadata ON payment_orders USING GIN(booking_metadata);
  CREATE INDEX IF NOT EXISTS idx_payment_orders_tour_bookings ON payment_orders((booking_metadata->>'booking_type')) WHERE booking_metadata->>'booking_type' = 'tour';
`;
