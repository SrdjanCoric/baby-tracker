ALTER TABLE wake_window_preferences REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE wake_window_preferences;
