ALTER TABLE diapers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE pumping_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE growth_measurements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tummy_time_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE diapers SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE pumping_sessions SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE growth_measurements SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE tummy_time_sessions SET updated_at = created_at WHERE updated_at IS NULL;
