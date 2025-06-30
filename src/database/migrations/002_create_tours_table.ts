export const createToursTable = `
  CREATE TABLE IF NOT EXISTS tours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_prices JSONB DEFAULT '{}'::jsonb,
    individual_prices JSONB DEFAULT '{}'::jsonb,
    localizations JSONB NOT NULL,
    day VARCHAR(255) NOT NULL,
    night VARCHAR(255) NOT NULL,
    public BOOLEAN DEFAULT FALSE,
    type BOOLEAN DEFAULT FALSE,
    daily BOOLEAN DEFAULT FALSE, 
    image TEXT,
    gallery TEXT[] DEFAULT ARRAY[]::TEXT[],
    date DATE,
    amount_persons INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_tours_public ON tours(public);
  CREATE INDEX IF NOT EXISTS idx_tours_type ON tours(type);
  CREATE INDEX IF NOT EXISTS idx_tours_date ON tours(date);
  CREATE INDEX IF NOT EXISTS idx_tours_localizations ON tours USING GIN(localizations);
`;
