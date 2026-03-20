ALTER TABLE health_entries ADD COLUMN dosage_unit TEXT DEFAULT 'ml';
ALTER TABLE health_entries ADD COLUMN dose_number INTEGER;

ALTER TABLE health_entries ADD CONSTRAINT chk_dosage_unit
  CHECK (dosage_unit IN ('ml', 'mg', 'drops') OR dosage_unit IS NULL);
ALTER TABLE health_entries ADD CONSTRAINT chk_dose_number
  CHECK (dose_number > 0 OR dose_number IS NULL);
ALTER TABLE health_entries ADD CONSTRAINT chk_dosage_positive
  CHECK (dosage_amount > 0 OR dosage_amount IS NULL);
