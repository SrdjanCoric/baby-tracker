# Test Coverage Implementation Progress

## Tasks

- [x] 1. Fix `sync-context.test.ts` — import real reducer instead of re-implementing locally
- [x] 2. Create shared Supabase mock utility
- [x] 3. Delete/rewrite `timer-sync.edge-case.test.ts` — remove false-confidence tests
- [x] 4. Test `active-timers-context` reducer (pure function, no mocking needed) — 16 tests
- [x] 5. Test `active-timer-service.ts` — lock acquire/release, contention, PGRST116 — 23 tests
- [x] 6. Test `baby-sync-service.ts` — guest migration, ID remapping, CRUD — 15 tests
- [x] 7. Test `push-token-service.ts` — upsert, auth-gated, conflict resolution — 23 tests
- [x] 8. Test `notification-service.ts` — module availability, iOS limits, permissions — 17 tests
- [x] 9. Test `activity-sync-service.ts` — transforms, CRUD, guest migration — 20 tests
- [x] 10. Test feeding context reducer — timer transitions, REMOTE_* actions, side suggestion — 30 tests
