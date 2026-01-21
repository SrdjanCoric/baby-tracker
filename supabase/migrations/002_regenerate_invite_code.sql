-- Function to regenerate invite code for a household
-- Only household members can regenerate the code
CREATE OR REPLACE FUNCTION regenerate_invite_code(household_id UUID)
RETURNS VARCHAR(8) AS $$
DECLARE
  new_code VARCHAR(8);
  user_household_id UUID;
BEGIN
  -- Check if the user belongs to this household
  SELECT u.household_id INTO user_household_id
  FROM users u
  WHERE u.id = auth.uid();

  IF user_household_id IS NULL OR user_household_id != household_id THEN
    RAISE EXCEPTION 'Not authorized to regenerate invite code for this household';
  END IF;

  -- Generate a new unique code
  new_code := generate_invite_code();
  WHILE EXISTS (SELECT 1 FROM households WHERE invite_code = new_code) LOOP
    new_code := generate_invite_code();
  END LOOP;

  -- Update the household with the new code
  UPDATE households
  SET invite_code = new_code
  WHERE id = household_id;

  RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
