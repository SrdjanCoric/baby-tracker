-- Migration: Fix invite code generation security in remove_caregiver function
-- The original implementation used md5() which has lower entropy than gen_random_bytes()
-- This migration updates to use the cryptographic method for better security

-- ============================================
-- HELPER FUNCTION: Generate Secure Invite Code
-- ============================================

CREATE OR REPLACE FUNCTION generate_secure_invite_code()
RETURNS VARCHAR(8)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR(8) := '';
  rand_bytes BYTEA;
  i INTEGER;
BEGIN
  rand_bytes := gen_random_bytes(8);
  FOR i IN 0..7 LOOP
    result := result || substr(chars, (get_byte(rand_bytes, i) % length(chars)) + 1, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- ============================================
-- UPDATED REMOVE_CAREGIVER FUNCTION
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
  new_invite_code VARCHAR(8);
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

  -- Generate a cryptographically secure invite code for new household
  new_invite_code := generate_secure_invite_code();

  -- Retry if code exists (unlikely but possible)
  WHILE EXISTS (SELECT 1 FROM households WHERE invite_code = new_invite_code) LOOP
    new_invite_code := generate_secure_invite_code();
  END LOOP;

  -- Create a new solo household for the removed caregiver with secure invite code
  INSERT INTO households (invite_code)
  VALUES (new_invite_code)
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
-- UPDATE ORIGINAL GENERATE_INVITE_CODE FUNCTION
-- ============================================

-- Also update the original function for consistency
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS VARCHAR(8)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR(8) := '';
  rand_bytes BYTEA;
  i INTEGER;
BEGIN
  rand_bytes := gen_random_bytes(8);
  FOR i IN 0..7 LOOP
    result := result || substr(chars, (get_byte(rand_bytes, i) % length(chars)) + 1, 1);
  END LOOP;
  RETURN result;
END;
$$;
