-- Function to get household babies by invite code (bypasses RLS for join flow)
CREATE OR REPLACE FUNCTION get_household_babies_by_invite_code(p_invite_code VARCHAR(8))
RETURNS TABLE (
  baby_id UUID,
  baby_household_id UUID,
  baby_name VARCHAR(100),
  baby_birth_date DATE,
  baby_gender VARCHAR(10),
  baby_photo_url TEXT,
  baby_created_at TIMESTAMPTZ,
  baby_updated_at TIMESTAMPTZ
) AS $$
DECLARE
  v_household_id UUID;
BEGIN
  -- Find household by invite code
  SELECT h.id INTO v_household_id
  FROM households h
  WHERE UPPER(h.invite_code) = UPPER(p_invite_code);

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Household not found';
  END IF;

  -- Return babies for that household
  RETURN QUERY
  SELECT
    b.id AS baby_id,
    b.household_id AS baby_household_id,
    b.name AS baby_name,
    b.birth_date AS baby_birth_date,
    b.gender AS baby_gender,
    b.photo_url AS baby_photo_url,
    b.created_at AS baby_created_at,
    b.updated_at AS baby_updated_at
  FROM babies b
  WHERE b.household_id = v_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to leave current household and create a new one
-- This handles everything atomically to prevent inconsistent states
CREATE OR REPLACE FUNCTION leave_household()
RETURNS TABLE (household_id UUID, household_invite_code VARCHAR(8), household_created_at TIMESTAMPTZ) AS $$
DECLARE
  v_user_id UUID;
  v_current_household_id UUID;
  v_is_owner BOOLEAN;
  v_new_household_id UUID;
  v_new_code VARCHAR(8);
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user's current household and owner status
  SELECT u.household_id, u.is_owner INTO v_current_household_id, v_is_owner
  FROM users u
  WHERE u.id = v_user_id;

  IF v_current_household_id IS NULL THEN
    RAISE EXCEPTION 'User is not in a household';
  END IF;

  IF v_is_owner THEN
    RAISE EXCEPTION 'Owner cannot leave household';
  END IF;

  -- Generate a unique invite code for the new household
  v_new_code := generate_invite_code();
  WHILE EXISTS (SELECT 1 FROM households WHERE invite_code = v_new_code) LOOP
    v_new_code := generate_invite_code();
  END LOOP;

  -- Create new household
  INSERT INTO households (invite_code)
  VALUES (v_new_code)
  RETURNING id INTO v_new_household_id;

  -- Update user to new household and make them owner
  UPDATE users
  SET household_id = v_new_household_id, is_owner = true
  WHERE id = v_user_id;

  -- Return the new household data
  RETURN QUERY
  SELECT h.id AS household_id, h.invite_code AS household_invite_code, h.created_at AS household_created_at
  FROM households h
  WHERE h.id = v_new_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
