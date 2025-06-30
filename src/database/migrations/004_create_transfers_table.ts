export const createTransfersTable = `
  CREATE TABLE IF NOT EXISTS transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    localizations JSONB NOT NULL,
    prices JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  
  -- Add updated_at column if it doesn't exist
  DO $$
  BEGIN 
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'transfers' AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE transfers ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
  END $$;
  
  CREATE INDEX IF NOT EXISTS idx_transfers_localizations ON transfers USING GIN(localizations);
`;
