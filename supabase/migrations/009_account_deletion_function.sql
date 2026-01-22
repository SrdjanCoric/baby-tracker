-- Migration: Account Deletion RPC function
-- Allows users to delete their own account and associated data

-- ============================================
-- AUDIT LOG TABLE FOR DELETIONS
-- ============================================

CREATE TABLE IF NOT EXISTS deletion_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_user_id UUID NOT NULL,
  deletion_method VARCHAR(50) NOT NULL DEFAULT 'self-service',
  activities_deleted INTEGER DEFAULT 0,
  babies_deleted INTEGER DEFAULT 0,
  household_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RPC FUNCTION TO DELETE USER ACCOUNT
-- ============================================

CREATE OR REPLACE FUNCTION delete_user_account(user_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requesting_user_id UUID;
  user_household_id UUID;
  member_count INTEGER;
  activities_count INTEGER := 0;
  babies_count INTEGER := 0;
  temp_count INTEGER;
BEGIN
  -- Get the requesting user
  requesting_user_id := auth.uid();

  -- Security check: Only allow users to delete their own account
  IF requesting_user_id IS NULL OR requesting_user_id != user_id_param THEN
    RAISE EXCEPTION 'You can only delete your own account'
      USING ERRCODE = '42501';
  END IF;

  -- Get user's household
  SELECT household_id INTO user_household_id
  FROM users
  WHERE id = user_id_param;

  -- Start transaction (implicit in PostgreSQL function)

  -- Delete user's activities and count them
  DELETE FROM feedings WHERE logged_by = user_id_param;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  activities_count := activities_count + temp_count;

  DELETE FROM sleep_sessions WHERE logged_by = user_id_param;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  activities_count := activities_count + temp_count;

  DELETE FROM diapers WHERE logged_by = user_id_param;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  activities_count := activities_count + temp_count;

  DELETE FROM pumping_sessions WHERE logged_by = user_id_param;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  activities_count := activities_count + temp_count;

  DELETE FROM growth_measurements WHERE logged_by = user_id_param;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  activities_count := activities_count + temp_count;

  DELETE FROM tummy_time_sessions WHERE logged_by = user_id_param;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  activities_count := activities_count + temp_count;

  -- Check if user is last in household
  IF user_household_id IS NOT NULL THEN
    SELECT COUNT(*) INTO member_count
    FROM users
    WHERE household_id = user_household_id;

    IF member_count = 1 THEN
      -- Delete babies (activities already deleted via CASCADE or logged_by)
      SELECT COUNT(*) INTO babies_count
      FROM babies
      WHERE household_id = user_household_id;

      DELETE FROM babies WHERE household_id = user_household_id;

      -- Delete household
      DELETE FROM households WHERE id = user_household_id;

      -- Log deletion with household
      INSERT INTO deletion_audit_log (
        deleted_user_id,
        deletion_method,
        activities_deleted,
        babies_deleted,
        household_deleted
      ) VALUES (
        user_id_param,
        'self-service',
        activities_count,
        babies_count,
        TRUE
      );
    ELSE
      -- Log deletion without household
      INSERT INTO deletion_audit_log (
        deleted_user_id,
        deletion_method,
        activities_deleted,
        babies_deleted,
        household_deleted
      ) VALUES (
        user_id_param,
        'self-service',
        activities_count,
        0,
        FALSE
      );
    END IF;
  ELSE
    -- No household, just log the deletion
    INSERT INTO deletion_audit_log (
      deleted_user_id,
      deletion_method,
      activities_deleted,
      babies_deleted,
      household_deleted
    ) VALUES (
      user_id_param,
      'self-service',
      activities_count,
      0,
      FALSE
    );
  END IF;

  -- Delete user profile (this will cascade from auth.users deletion)
  -- but we delete explicitly to ensure it happens in this transaction
  DELETE FROM users WHERE id = user_id_param;

  -- Note: The actual auth.users deletion is handled by the client
  -- calling supabase.auth.admin.deleteUser() or the user can delete
  -- their auth account separately
END;
$$;

-- ============================================
-- GRANT EXECUTE PERMISSION
-- ============================================

GRANT EXECUTE ON FUNCTION delete_user_account TO authenticated;

-- ============================================
-- RLS POLICY FOR AUDIT LOG (ADMIN ONLY)
-- ============================================

ALTER TABLE deletion_audit_log ENABLE ROW LEVEL SECURITY;

-- Only allow service role to read audit logs
CREATE POLICY "Service role can read audit logs" ON deletion_audit_log
  FOR SELECT USING (FALSE);
