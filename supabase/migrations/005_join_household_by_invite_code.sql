-- Function to join an existing household via invite code
-- Returns the household data on success
CREATE OR REPLACE FUNCTION join_household_by_invite_code(p_invite_code VARCHAR(8))
RETURNS TABLE (id UUID, invite_code VARCHAR(8), created_at TIMESTAMPTZ) AS $$
DECLARE
  target_household_id UUID;
  current_household_id UUID;
BEGIN
  -- Get user's current household
  SELECT u.household_id INTO current_household_id
  FROM users u
  WHERE u.id = auth.uid();

  -- Check if user already belongs to a household with other members
  IF current_household_id IS NOT NULL THEN
    -- Check if there are other members in the current household
    IF EXISTS (
      SELECT 1 FROM users
      WHERE household_id = current_household_id
      AND id != auth.uid()
    ) THEN
      RAISE EXCEPTION 'User already belongs to a household with other members';
    END IF;
  END IF;

  -- Find household by invite code (case-insensitive)
  SELECT h.id INTO target_household_id
  FROM households h
  WHERE UPPER(h.invite_code) = UPPER(p_invite_code);

  IF target_household_id IS NULL THEN
    RAISE EXCEPTION 'Household not found';
  END IF;

  -- Don't allow joining own household
  IF target_household_id = current_household_id THEN
    RAISE EXCEPTION 'User already belongs to this household';
  END IF;

  -- Update user's household_id to the new household
  UPDATE users
  SET household_id = target_household_id
  WHERE users.id = auth.uid();

  -- Delete the old empty household if it exists and has no members
  IF current_household_id IS NOT NULL THEN
    DELETE FROM households
    WHERE households.id = current_household_id
    AND NOT EXISTS (
      SELECT 1 FROM users WHERE household_id = current_household_id
    );
  END IF;

  -- Return the joined household data
  RETURN QUERY
  SELECT h.id, h.invite_code, h.created_at
  FROM households h
  WHERE h.id = target_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
