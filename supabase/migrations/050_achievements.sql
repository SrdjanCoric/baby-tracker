CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(baby_id, achievement_id)
);

CREATE INDEX idx_achievements_baby_id ON achievements(baby_id);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view achievements for their household babies"
  ON achievements FOR SELECT
  USING (baby_id IN (SELECT id FROM babies WHERE household_id = (
    SELECT household_id FROM users WHERE id = auth.uid()
  )));

CREATE POLICY "Users can insert achievements for their household babies"
  ON achievements FOR INSERT
  WITH CHECK (baby_id IN (SELECT id FROM babies WHERE household_id = (
    SELECT household_id FROM users WHERE id = auth.uid()
  )));

CREATE POLICY "Users can delete achievements for their household babies"
  ON achievements FOR DELETE
  USING (baby_id IN (SELECT id FROM babies WHERE household_id = (
    SELECT household_id FROM users WHERE id = auth.uid()
  )));

ALTER PUBLICATION supabase_realtime ADD TABLE achievements;
