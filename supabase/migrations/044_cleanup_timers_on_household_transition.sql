-- Fix orphaned timer locks when a user leaves or is removed from a household.
-- Without this, active_timers rows from the departing user permanently block
-- other caregivers from the affected activity type.

-- Recreate leave_household with timer lock cleanup
CREATE OR REPLACE FUNCTION leave_household()
RETURNS TABLE (household_id UUID, household_invite_code VARCHAR(8), household_created_at TIMESTAMPTZ) AS $$
DECLARE
  v_user_id UUID;
  v_current_household_id UUID;
  v_is_owner BOOLEAN;
  v_new_household_id UUID;
  v_new_code VARCHAR(8);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT u.household_id, u.is_owner INTO v_current_household_id, v_is_owner
  FROM users u
  WHERE u.id = v_user_id;

  IF v_current_household_id IS NULL THEN
    RAISE EXCEPTION 'User is not in a household';
  END IF;

  IF v_is_owner THEN
    RAISE EXCEPTION 'Owner cannot leave household';
  END IF;

  -- Clean up any active timer locks held by this user
  DELETE FROM active_timers WHERE started_by = v_user_id;

  v_new_code := generate_invite_code();
  WHILE EXISTS (SELECT 1 FROM households WHERE invite_code = v_new_code) LOOP
    v_new_code := generate_invite_code();
  END LOOP;

  INSERT INTO households (invite_code)
  VALUES (v_new_code)
  RETURNING id INTO v_new_household_id;

  UPDATE users
  SET household_id = v_new_household_id, is_owner = true
  WHERE id = v_user_id;

  RETURN QUERY
  SELECT h.id AS household_id, h.invite_code AS household_invite_code, h.created_at AS household_created_at
  FROM households h
  WHERE h.id = v_new_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate remove_caregiver with timer lock cleanup
CREATE OR REPLACE FUNCTION remove_caregiver(
  caregiver_id UUID,
  household_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requesting_user_id UUID;
  is_requesting_user_owner BOOLEAN;
  is_target_owner BOOLEAN;
  target_household_id UUID;
  new_household_id UUID;
  member_count INTEGER;
BEGIN
  requesting_user_id := auth.uid();

  SELECT is_owner INTO is_requesting_user_owner
  FROM users
  WHERE id = requesting_user_id
  AND users.household_id = remove_caregiver.household_id;

  IF NOT FOUND OR NOT is_requesting_user_owner THEN
    RAISE EXCEPTION 'Only household owner can remove caregivers'
      USING ERRCODE = '42501';
  END IF;

  IF requesting_user_id = caregiver_id THEN
    RAISE EXCEPTION 'Cannot remove yourself from household'
      USING ERRCODE = 'SELF_REMOVAL';
  END IF;

  SELECT users.household_id, is_owner INTO target_household_id, is_target_owner
  FROM users
  WHERE id = caregiver_id;

  IF target_household_id IS NULL OR target_household_id != remove_caregiver.household_id THEN
    RAISE EXCEPTION 'Caregiver not found in household';
  END IF;

  IF is_target_owner THEN
    RAISE EXCEPTION 'Cannot remove household owner';
  END IF;

  -- Clean up any active timer locks held by the removed caregiver
  DELETE FROM active_timers WHERE started_by = caregiver_id;

  INSERT INTO households (invite_code)
  VALUES (
    upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8))
  )
  RETURNING id INTO new_household_id;

  UPDATE users
  SET household_id = new_household_id,
      is_owner = TRUE
  WHERE id = caregiver_id;

  SELECT COUNT(*) INTO member_count
  FROM users
  WHERE users.household_id = remove_caregiver.household_id;

  IF member_count = 0 THEN
    DELETE FROM households WHERE id = remove_caregiver.household_id;
  END IF;

  RETURN TRUE;
END;
$$;
