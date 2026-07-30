\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE e2e_households_to_remove ON COMMIT DROP AS
SELECT household_id AS id
FROM public.users
WHERE email IN (
  'e2e-owner@test.local',
  'e2e-member@test.local',
  'e2e-test@test.local',
  'e2e-new-owner@test.local'
)
UNION
SELECT id
FROM public.households
WHERE id IN (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  '00000000-0000-0000-0000-000000000004'::uuid
);

DELETE FROM public.active_timers
WHERE baby_id IN (
  SELECT id
  FROM public.babies
  WHERE household_id IN (SELECT id FROM e2e_households_to_remove)
);

DELETE FROM public.babies
WHERE household_id IN (SELECT id FROM e2e_households_to_remove)
   OR id IN (
     '00000000-0000-0000-0001-000000000001'::uuid,
     '00000000-0000-0000-0001-000000000002'::uuid,
     '00000000-0000-0000-0001-000000000003'::uuid
   );

DELETE FROM auth.users
WHERE email IN (
  'e2e-owner@test.local',
  'e2e-member@test.local',
  'e2e-test@test.local',
  'e2e-new-owner@test.local'
);

DELETE FROM public.households h
WHERE h.id IN (SELECT id FROM e2e_households_to_remove)
  AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.household_id = h.id)
  AND NOT EXISTS (SELECT 1 FROM public.babies b WHERE b.household_id = h.id);

COMMIT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE email IN (
      'e2e-owner@test.local',
      'e2e-member@test.local',
      'e2e-test@test.local',
      'e2e-new-owner@test.local'
    )
  ) OR EXISTS (
    SELECT 1 FROM public.users
    WHERE email IN (
      'e2e-owner@test.local',
      'e2e-member@test.local',
      'e2e-test@test.local',
      'e2e-new-owner@test.local'
    )
  ) OR EXISTS (
    SELECT 1 FROM public.babies
    WHERE id IN (
      '00000000-0000-0000-0001-000000000001'::uuid,
      '00000000-0000-0000-0001-000000000002'::uuid,
      '00000000-0000-0000-0001-000000000003'::uuid
    )
  ) OR EXISTS (
    SELECT 1 FROM public.households
    WHERE id IN (
      '00000000-0000-0000-0000-000000000001'::uuid,
      '00000000-0000-0000-0000-000000000002'::uuid,
      '00000000-0000-0000-0000-000000000003'::uuid,
      '00000000-0000-0000-0000-000000000004'::uuid
    )
  ) THEN
    RAISE EXCEPTION 'E2E cleanup left fixture rows behind';
  END IF;
END
$$;

SELECT 'E2E cleanup verified' AS result;
