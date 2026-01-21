-- Migration: Caregiver removal RPC function
-- Allows household owners to safely remove caregivers

-- ============================================
-- ADD is_owner COLUMN IF NOT EXISTS
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_owner'
  ) THEN
    ALTER TABLE users ADD COLUMN is_owner BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- ============================================
-- RPC FUNCTION TO REMOVE CAREGIVER
-- ============================================

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
  -- Get the requesting user
  requesting_user_id := auth.uid();

  -- Check if requesting user is the owner of this household
  SELECT is_owner INTO is_requesting_user_owner
  FROM users
  WHERE id = requesting_user_id
  AND users.household_id = remove_caregiver.household_id;

  IF NOT FOUND OR NOT is_requesting_user_owner THEN
    RAISE EXCEPTION 'Only household owner can remove caregivers'
      USING ERRCODE = '42501';
  END IF;

  -- Check if trying to remove self
  IF requesting_user_id = caregiver_id THEN
    RAISE EXCEPTION 'Cannot remove yourself from household'
      USING ERRCODE = 'SELF_REMOVAL';
  END IF;

  -- Verify the target caregiver is in this household
  SELECT users.household_id, is_owner INTO target_household_id, is_target_owner
  FROM users
  WHERE id = caregiver_id;

  IF target_household_id IS NULL OR target_household_id != remove_caregiver.household_id THEN
    RAISE EXCEPTION 'Caregiver not found in household';
  END IF;

  -- Cannot remove another owner (shouldn't happen, but safety check)
  IF is_target_owner THEN
    RAISE EXCEPTION 'Cannot remove household owner';
  END IF;

  -- Create a new solo household for the removed caregiver
  INSERT INTO households (invite_code)
  VALUES (
    upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8))
  )
  RETURNING id INTO new_household_id;

  -- Move the caregiver to their new household and make them owner
  UPDATE users
  SET household_id = new_household_id,
      is_owner = TRUE
  WHERE id = caregiver_id;

  -- Check if household is now empty (shouldn't happen but handle edge case)
  SELECT COUNT(*) INTO member_count
  FROM users
  WHERE users.household_id = remove_caregiver.household_id;

  -- If somehow household is empty, clean it up
  IF member_count = 0 THEN
    DELETE FROM households WHERE id = remove_caregiver.household_id;
  END IF;

  RETURN TRUE;
END;
$$;

-- ============================================
-- RLS POLICY FOR VIEWING HOUSEHOLD MEMBERS
-- ============================================

-- Drop existing policy if it exists and create new one
DROP POLICY IF EXISTS "Users can view household members" ON users;
CREATE POLICY "Users can view household members" ON users
  FOR SELECT USING (
    household_id IN (SELECT u.household_id FROM users u WHERE u.id = auth.uid())
  );
