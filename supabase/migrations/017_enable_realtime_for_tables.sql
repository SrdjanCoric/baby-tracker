-- Enable Supabase Realtime for tables that need real-time sync
-- This allows household members to see changes made by other caregivers in real-time

-- Set REPLICA IDENTITY FULL so DELETE and UPDATE events include full row data
-- This is required for realtime subscriptions to work properly
ALTER TABLE babies REPLICA IDENTITY FULL;
ALTER TABLE feedings REPLICA IDENTITY FULL;
ALTER TABLE sleep_sessions REPLICA IDENTITY FULL;
ALTER TABLE diapers REPLICA IDENTITY FULL;
ALTER TABLE pumping_sessions REPLICA IDENTITY FULL;
ALTER TABLE growth_measurements REPLICA IDENTITY FULL;
ALTER TABLE tummy_time_sessions REPLICA IDENTITY FULL;
ALTER TABLE users REPLICA IDENTITY FULL;
ALTER TABLE households REPLICA IDENTITY FULL;

-- Note: Tables must also be added to supabase_realtime publication
-- This is typically done in Supabase Dashboard: Database -> Replication
-- Or run these if not already added:
-- ALTER PUBLICATION supabase_realtime ADD TABLE babies;
-- ALTER PUBLICATION supabase_realtime ADD TABLE feedings;
-- etc.
