ALTER TABLE health_entries DROP CONSTRAINT IF EXISTS chk_dosage_unit;
ALTER TABLE health_entries ADD CONSTRAINT chk_dosage_unit
  CHECK (dosage_unit IN ('ml', 'mg', 'drops', 'tsp') OR dosage_unit IS NULL);
