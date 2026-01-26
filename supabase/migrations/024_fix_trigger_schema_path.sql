-- Fix: Add explicit schema prefixes to handle_new_user trigger
-- The trigger on auth.users runs in auth schema context and couldn't find
-- public schema functions without explicit prefixes.
-- This caused magic link auth to fail with "function create_household_with_code() does not exist"

-- Update handle_new_user to use explicit public schema for function call
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_household_id UUID;
BEGIN
  new_household_id := public.create_household_with_code();
  INSERT INTO public.users (id, email, household_id, is_owner)
  VALUES (NEW.id, NEW.email, new_household_id, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger with explicit schema reference
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
