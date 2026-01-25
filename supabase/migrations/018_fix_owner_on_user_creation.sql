-- Fix: Set is_owner = true for users who created their household
-- The is_owner column was added in migration 007 but the handle_new_user trigger
-- was never updated to set it to true for new users.

-- ============================================
-- FIX EXISTING DATA
-- ============================================

-- Set is_owner = true for users who are alone in their household
-- (they must be the original creator)
UPDATE users u
SET is_owner = true
WHERE is_owner = false
AND (
  SELECT COUNT(*) FROM users u2 WHERE u2.household_id = u.household_id
) = 1;

-- For households with multiple members, the first user to join (by created_at)
-- should be the owner. This handles cases where both users have is_owner = false.
WITH first_members AS (
  SELECT DISTINCT ON (household_id) id, household_id
  FROM users
  WHERE household_id IS NOT NULL
  ORDER BY household_id, created_at ASC
)
UPDATE users u
SET is_owner = true
FROM first_members fm
WHERE u.id = fm.id
AND u.is_owner = false
AND NOT EXISTS (
  SELECT 1 FROM users u2
  WHERE u2.household_id = u.household_id
  AND u2.is_owner = true
);

-- ============================================
-- UPDATE TRIGGER FUNCTION
-- ============================================

-- Update the handle_new_user function to set is_owner = true
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_household_id UUID;
BEGIN
  -- Create a new household for the user
  new_household_id := create_household_with_code();

  -- Insert the user with the new household and set them as owner
  INSERT INTO public.users (id, email, household_id, is_owner)
  VALUES (NEW.id, NEW.email, new_household_id, true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
