export const createEmailVerificationTable = `
  CREATE TABLE IF NOT EXISTS email_verification (
    email VARCHAR(100) PRIMARY KEY,
    code VARCHAR(6) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  
  -- Add expires_at column if it doesn't exist
  DO $$
  BEGIN 
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'email_verification' 
      AND column_name = 'expires_at'
    ) THEN
      ALTER TABLE email_verification 
      ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '15 minutes');
    END IF;
  END $$;
  
  -- Create index only after ensuring column exists
  CREATE INDEX IF NOT EXISTS idx_email_verification_expires_at ON email_verification(expires_at);
`;
