-- Add explicit search_path to SECURITY DEFINER functions
-- Prevents privilege escalation via malicious schema injection

-- Update create_household_with_code function
CREATE OR REPLACE FUNCTION create_household_with_code()
RETURNS UUID AS $$
DECLARE
  new_id UUID;
  new_code VARCHAR(8);
BEGIN
  new_code := generate_invite_code();
  WHILE EXISTS (SELECT 1 FROM households WHERE invite_code = new_code) LOOP
    new_code := generate_invite_code();
  END LOOP;

  INSERT INTO households (invite_code) VALUES (new_code) RETURNING id INTO new_id;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update handle_new_user function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_household_id UUID;
BEGIN
  new_household_id := create_household_with_code();

  INSERT INTO public.users (id, email, household_id)
  VALUES (NEW.id, NEW.email, new_household_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update regenerate_invite_code function
CREATE OR REPLACE FUNCTION regenerate_invite_code(household_id UUID)
RETURNS VARCHAR(8) AS $$
DECLARE
  new_code VARCHAR(8);
  user_household_id UUID;
BEGIN
  SELECT u.household_id INTO user_household_id
  FROM users u
  WHERE u.id = auth.uid();

  IF user_household_id IS NULL OR user_household_id != household_id THEN
    RAISE EXCEPTION 'Not authorized to regenerate invite code for this household';
  END IF;

  new_code := generate_invite_code();
  WHILE EXISTS (SELECT 1 FROM households WHERE invite_code = new_code) LOOP
    new_code := generate_invite_code();
  END LOOP;

  UPDATE households
  SET invite_code = new_code
  WHERE id = household_id;

  RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
