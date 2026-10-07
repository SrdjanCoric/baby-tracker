-- Import deduplication includes deleted rows; the existing household SELECT policy
-- restricts these identities to the signed-in caregiver's household.
GRANT SELECT (id, baby_id)
ON TABLE public.health_entries TO authenticated;
