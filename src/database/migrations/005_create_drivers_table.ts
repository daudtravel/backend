export const createDriversTable = `
  CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firstname VARCHAR(255) NOT NULL,
    lastname VARCHAR(255) NOT NULL,
    image TEXT
  );
  
  -- Add missing columns if they don't exist
  DO $$
  BEGIN 
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'drivers' AND column_name = 'active'
    ) THEN
      ALTER TABLE drivers ADD COLUMN active BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'drivers' AND column_name = 'created_at'
    ) THEN
      ALTER TABLE drivers ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'drivers' AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE drivers ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
  END $$;
  
  CREATE INDEX IF NOT EXISTS idx_drivers_active ON drivers(active);
  CREATE INDEX IF NOT EXISTS idx_drivers_name ON drivers(firstname, lastname);
`;
