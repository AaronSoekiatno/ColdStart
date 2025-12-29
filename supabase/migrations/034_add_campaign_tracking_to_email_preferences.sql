-- Add campaign tracking fields to email_preferences table
-- This allows tracking of lead and user campaign sends separately

ALTER TABLE public.email_preferences
ADD COLUMN IF NOT EXISTS lead_campaign_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS lead_campaign_status TEXT CHECK (lead_campaign_status IN ('pending', 'sent', 'failed')),
ADD COLUMN IF NOT EXISTS lead_campaign_error TEXT,
ADD COLUMN IF NOT EXISTS user_campaign_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS user_campaign_status TEXT CHECK (user_campaign_status IN ('pending', 'sent', 'failed')),
ADD COLUMN IF NOT EXISTS user_campaign_error TEXT;

-- Add indexes for efficient filtering by campaign status
CREATE INDEX IF NOT EXISTS idx_email_preferences_lead_campaign_status 
ON public.email_preferences(lead_campaign_status);

CREATE INDEX IF NOT EXISTS idx_email_preferences_user_campaign_status 
ON public.email_preferences(user_campaign_status);

-- Add indexes for sorting by sent dates
CREATE INDEX IF NOT EXISTS idx_email_preferences_lead_campaign_sent_at 
ON public.email_preferences(lead_campaign_sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_preferences_user_campaign_sent_at 
ON public.email_preferences(user_campaign_sent_at DESC);

-- Add comments to document the columns
COMMENT ON COLUMN public.email_preferences.lead_campaign_sent_at IS 'Timestamp when lead campaign email was sent';
COMMENT ON COLUMN public.email_preferences.lead_campaign_status IS 'Status of lead campaign send: pending, sent, or failed';
COMMENT ON COLUMN public.email_preferences.lead_campaign_error IS 'Error message if lead campaign send failed';
COMMENT ON COLUMN public.email_preferences.user_campaign_sent_at IS 'Timestamp when user campaign email was sent';
COMMENT ON COLUMN public.email_preferences.user_campaign_status IS 'Status of user campaign send: pending, sent, or failed';
COMMENT ON COLUMN public.email_preferences.user_campaign_error IS 'Error message if user campaign send failed';

