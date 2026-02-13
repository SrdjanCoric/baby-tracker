-- Fix: delete_user_account fails with FK violation (23503) when deleting household
-- The function tried to DELETE FROM households before removing the user's reference to it.
-- users.household_id REFERENCES households(id) without CASCADE, so the delete was blocked.
-- Fix: null out the user's household_id before deleting the household.

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
  requesting_user_id := auth.uid();

  IF requesting_user_id IS NULL OR requesting_user_id != user_id_param THEN
    RAISE EXCEPTION 'You can only delete your own account'
      USING ERRCODE = '42501';
  END IF;

  SELECT household_id INTO user_household_id
  FROM users
  WHERE id = user_id_param;

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

  IF user_household_id IS NOT NULL THEN
    SELECT COUNT(*) INTO member_count
    FROM users
    WHERE household_id = user_household_id;

    IF member_count = 1 THEN
      SELECT COUNT(*) INTO babies_count
      FROM babies
      WHERE household_id = user_household_id;

      -- Detach user from household BEFORE deleting it to avoid FK violation
      UPDATE users SET household_id = NULL WHERE id = user_id_param;

      DELETE FROM babies WHERE household_id = user_household_id;

      DELETE FROM households WHERE id = user_household_id;

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

  DELETE FROM users WHERE id = user_id_param;
END;
$$;
