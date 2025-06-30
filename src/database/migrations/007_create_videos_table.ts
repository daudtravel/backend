export const createVideosTable = `
  CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    youtube_link TEXT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  
  -- Add missing columns if they don't exist
  DO $$
  BEGIN 
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'videos' AND column_name = 'active'
    ) THEN
      ALTER TABLE videos ADD COLUMN active BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'videos' AND column_name = 'order_index'
    ) THEN
      ALTER TABLE videos ADD COLUMN order_index INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'videos' AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE videos ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
  END $$;
  
  CREATE INDEX IF NOT EXISTS idx_videos_active ON videos(active);
  CREATE INDEX IF NOT EXISTS idx_videos_order ON videos(order_index);
`;
