-- Add last_used_at column for tracking token usage
ALTER TABLE user_push_tokens
ADD COLUMN last_used_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX idx_push_tokens_last_used ON user_push_tokens(last_used_at);

-- Cleanup function for tokens not used in 90 days
CREATE OR REPLACE FUNCTION cleanup_stale_push_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_push_tokens
  WHERE last_used_at < now() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Drop the orphaned function from migration 011
DROP FUNCTION IF EXISTS get_household_push_tokens(UUID, UUID);
