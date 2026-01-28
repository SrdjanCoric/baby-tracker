-- Fix: Include extensions schema in search_path for functions using gen_random_bytes
-- The gen_random_bytes function from pgcrypto is installed in the extensions schema

-- Update generate_invite_code to include extensions in search_path
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS VARCHAR(8)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

-- Update generate_secure_invite_code to include extensions in search_path
CREATE OR REPLACE FUNCTION public.generate_secure_invite_code()
RETURNS VARCHAR(8)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
