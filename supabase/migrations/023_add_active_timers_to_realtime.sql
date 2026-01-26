-- Add active_timers table to Supabase realtime publication
-- This enables real-time sync for timer locks between household members

ALTER PUBLICATION supabase_realtime ADD TABLE active_timers;
