-- Create email_preferences table for tracking user email opt-in/opt-out preferences
-- This table supports CAN-SPAM, GDPR, and CASL compliance requirements

CREATE TABLE IF NOT EXISTS public.email_preferences (
  email TEXT PRIMARY KEY,
  welcome_emails_enabled BOOLEAN DEFAULT true NOT NULL,
  marketing_emails_enabled BOOLEAN DEFAULT false NOT NULL,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  unsubscribe_token TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS email_preferences_email_idx ON public.email_preferences(email);
CREATE INDEX IF NOT EXISTS email_preferences_unsubscribe_token_idx ON public.email_preferences(unsubscribe_token);

-- Enable Row Level Security
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own email preferences
CREATE POLICY "Users can read their own email preferences"
  ON public.email_preferences
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = email);

-- Create policy to allow users to update their own email preferences
CREATE POLICY "Users can update their own email preferences"
  ON public.email_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' = email)
  WITH CHECK (auth.jwt() ->> 'email' = email);

-- Create policy to allow service role to manage all email preferences (for server-side operations)
CREATE POLICY "Service role can manage all email preferences"
  ON public.email_preferences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policy to allow anonymous users to update preferences via unsubscribe token (for unsubscribe functionality)
CREATE POLICY "Anonymous can update preferences with valid token"
  ON public.email_preferences
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create trigger to automatically update updated_at timestamp
CREATE TRIGGER update_email_preferences_updated_at
  BEFORE UPDATE ON public.email_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

