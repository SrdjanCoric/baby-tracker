-- Add 'dry' to diaper type constraint
-- Needed to support logging dry diaper changes

-- Drop existing constraint and add updated one with 'dry' option
ALTER TABLE diapers DROP CONSTRAINT IF EXISTS diapers_type_check;
ALTER TABLE diapers ADD CONSTRAINT diapers_type_check
  CHECK (type IN ('wet', 'dirty', 'mixed', 'dry'));
