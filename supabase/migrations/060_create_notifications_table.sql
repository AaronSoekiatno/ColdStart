-- Create notifications table in candidate schema (schema name passed as parameter)
-- This migration is applied per candidate in their isolated schema

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_read ON notifications(read, created_at DESC);

-- Enable Realtime (broadcasts to candidate only via schema isolation)
-- Supabase Realtime automatically filters by schema
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
