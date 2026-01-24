-- Migration: Fix infinite recursion in users RLS policy
-- The policy "Users can view household members" causes infinite recursion
-- because it queries the users table to check if you can query the users table.
--
-- Fix: Create a SECURITY DEFINER function that bypasses RLS to get the user's household_id

-- ============================================
-- HELPER FUNCTION: Get current user's household_id (bypasses RLS)
-- ============================================

CREATE OR REPLACE FUNCTION get_my_household_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT household_id FROM users WHERE id = auth.uid();
$$;

-- ============================================
-- DROP AND RECREATE THE PROBLEMATIC POLICY
-- ============================================

-- Drop the recursive policy
DROP POLICY IF EXISTS "Users can view household members" ON users;

-- Recreate using the helper function (no recursion)
CREATE POLICY "Users can view household members" ON users
  FOR SELECT USING (
    household_id = get_my_household_id()
  );
