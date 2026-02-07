CREATE TABLE widget_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, device_token)
);

CREATE INDEX idx_widget_push_tokens_user ON widget_push_tokens(user_id);
ALTER TABLE widget_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own widget push tokens" ON widget_push_tokens
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own widget push tokens" ON widget_push_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own widget push tokens" ON widget_push_tokens
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own widget push tokens" ON widget_push_tokens
  FOR DELETE USING (user_id = auth.uid());
