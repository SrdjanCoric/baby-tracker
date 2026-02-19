ALTER TABLE growth_measurements
  ALTER COLUMN measured_at TYPE TIMESTAMPTZ
  USING measured_at::TIMESTAMPTZ;
