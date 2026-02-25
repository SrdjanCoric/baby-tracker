CREATE TABLE milestone_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  milestone_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'yes' CHECK (state IN ('yes', 'not_sure')),
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(baby_id, milestone_id)
);

ALTER TABLE milestone_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view milestone responses for their household babies"
  ON milestone_responses FOR SELECT
  USING (baby_id IN (SELECT id FROM babies WHERE household_id = (
    SELECT household_id FROM users WHERE id = auth.uid()
  )));

CREATE POLICY "Users can insert milestone responses for their household babies"
  ON milestone_responses FOR INSERT
  WITH CHECK (baby_id IN (SELECT id FROM babies WHERE household_id = (
    SELECT household_id FROM users WHERE id = auth.uid()
  )));

CREATE POLICY "Users can update milestone responses for their household babies"
  ON milestone_responses FOR UPDATE
  USING (baby_id IN (SELECT id FROM babies WHERE household_id = (
    SELECT household_id FROM users WHERE id = auth.uid()
  )));

CREATE POLICY "Users can delete milestone responses for their household babies"
  ON milestone_responses FOR DELETE
  USING (baby_id IN (SELECT id FROM babies WHERE household_id = (
    SELECT household_id FROM users WHERE id = auth.uid()
  )));

ALTER PUBLICATION supabase_realtime ADD TABLE milestone_responses;
