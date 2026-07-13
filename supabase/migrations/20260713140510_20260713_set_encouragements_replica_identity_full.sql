-- Required for Supabase Realtime to deliver full row data on RLS-enabled tables.
-- Without FULL, INSERT payloads may not include all columns, causing the
-- realtime callback to receive incomplete data (emoji/message missing).
ALTER TABLE encouragements REPLICA IDENTITY FULL;
