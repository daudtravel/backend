export const createFaqTable = `
  CREATE TABLE IF NOT EXISTS faq (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    localizations JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  
  -- Add missing columns if they don't exist
  DO $$
  BEGIN 
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'faq' AND column_name = 'active'
    ) THEN
      ALTER TABLE faq ADD COLUMN active BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'faq' AND column_name = 'order_index'
    ) THEN
      ALTER TABLE faq ADD COLUMN order_index INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'faq' AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE faq ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
  END $$;
  
  CREATE INDEX IF NOT EXISTS idx_faq_active ON faq(active);
  CREATE INDEX IF NOT EXISTS idx_faq_order ON faq(order_index);
  CREATE INDEX IF NOT EXISTS idx_faq_localizations ON faq USING GIN(localizations);
`;
