-- Add last_finished_side column to feedings table
-- This tracks which breast side was last used when finishing a feeding

ALTER TABLE feedings
ADD COLUMN IF NOT EXISTS last_finished_side VARCHAR(10)
CHECK (last_finished_side IN ('left', 'right', 'both'));
