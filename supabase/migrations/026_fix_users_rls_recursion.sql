-- Fix: Prevent infinite recursion in users RLS policy
-- The "Users can view household members" policy had a subquery that selected from users,
-- which triggered the same RLS policies again, causing infinite recursion.

-- Create a security definer function to get current user's household_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_current_user_household_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT household_id FROM public.users WHERE id = auth.uid();
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view household members" ON public.users;

-- Recreate using the security definer function
CREATE POLICY "Users can view household members" ON public.users
  FOR SELECT
  USING (household_id = public.get_current_user_household_id());
