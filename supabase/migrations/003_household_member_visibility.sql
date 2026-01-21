-- Fix RLS policy to allow users to view other household members
-- and update invite code generation to use cryptographic random

-- ============================================
-- RLS POLICY FIX
-- ============================================

-- Allow users to view other members in their household
CREATE POLICY "Users can view household members" ON users
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

-- ============================================
-- CRYPTOGRAPHIC INVITE CODE GENERATION
-- ============================================

-- Replace the non-cryptographic random() with gen_random_bytes()
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS VARCHAR(8) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR(8) := '';
  i INTEGER;
  rand_bytes BYTEA;
BEGIN
  rand_bytes := gen_random_bytes(8);
  FOR i IN 0..7 LOOP
    result := result || substr(chars, (get_byte(rand_bytes, i) % length(chars)) + 1, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
