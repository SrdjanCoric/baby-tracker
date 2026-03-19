CREATE TABLE health_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('medication', 'temperature', 'vaccination', 'symptom')),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,

  medication_name TEXT,
  dosage_ml REAL,
  reminder_interval_hours REAL,

  temperature_celsius REAL,
  measurement_method TEXT,

  vaccine_name TEXT,

  symptoms TEXT[],

  logged_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_health_entries_baby_id ON health_entries(baby_id);
CREATE INDEX idx_health_entries_logged_at ON health_entries(logged_at DESC);

ALTER TABLE health_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view health entries in their household"
  ON health_entries FOR SELECT
  USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert health entries in their household"
  ON health_entries FOR INSERT
  WITH CHECK (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can update health entries in their household"
  ON health_entries FOR UPDATE
  USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete health entries in their household"
  ON health_entries FOR DELETE
  USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE health_entries;
