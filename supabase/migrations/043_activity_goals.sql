-- Activity goals table: household-shared sleep & tummy time goals per baby
CREATE TABLE activity_goals (
  baby_id UUID NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  goal_type VARCHAR(30) NOT NULL,
  target_value INTEGER NOT NULL,
  source VARCHAR(20) DEFAULT 'age_based',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (baby_id, goal_type)
);

ALTER TABLE activity_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view household activity goals" ON activity_goals
  FOR SELECT USING (baby_id IN (
    SELECT b.id FROM babies b JOIN users u ON b.household_id = u.household_id WHERE u.id = auth.uid()
  ));

CREATE POLICY "Users can insert household activity goals" ON activity_goals
  FOR INSERT WITH CHECK (baby_id IN (
    SELECT b.id FROM babies b JOIN users u ON b.household_id = u.household_id WHERE u.id = auth.uid()
  ));

CREATE POLICY "Users can update household activity goals" ON activity_goals
  FOR UPDATE USING (baby_id IN (
    SELECT b.id FROM babies b JOIN users u ON b.household_id = u.household_id WHERE u.id = auth.uid()
  ));

CREATE POLICY "Users can delete household activity goals" ON activity_goals
  FOR DELETE USING (baby_id IN (
    SELECT b.id FROM babies b JOIN users u ON b.household_id = u.household_id WHERE u.id = auth.uid()
  ));

ALTER TABLE activity_goals REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_goals;
