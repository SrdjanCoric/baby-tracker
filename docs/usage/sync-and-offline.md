# Sync and offline

- [x] [Today] Every change lands on screen and in local storage right away. — test: src/services/activity-sync-lossless.test.ts
- [ ] [Today] A queue sends changes to the server. It retries with growing delays and survives app restarts. — weak: src/services/sync/sync-lossless.test.ts
- [x] [Today] Only malformed changes are set aside. Nothing valid is dropped. — test: src/services/sync/sync-lossless.test.ts
- [ ] [Today] Opening the app sends queued changes first, then pulls updates. — weak: src/contexts/realtime-catchup.component.test.tsx
- [ ] [Bug] Today a cold app launch pulls updates first and sends queued changes about 300 ms later. (Found by reading code.)
- [x] [Today] Conflicts merge field by field. The newest change per field wins. — test: src/services/sync/crdt-sync-simulation.test.ts
- [x] [Today] Deleted entries are kept as hidden markers, so a delete reaches every device. — test: src/services/sync/sync-engine-crdt.test.ts
- [ ] [Today] Live updates come through one channel per household, limited to the household's own babies. A device ignores its own changes coming back. — weak: src/services/sync/real-time-sync.integration.test.ts
- [ ] [Today] Offline, a timer stopped on another device still shows as running here until reconnect.
- [ ] [Today] Statistics and timeline use each phone's local calendar. Entries don't store a time zone, so changing the phone's zone moves past entries between days. — weak: src/utils/statistics-local-dates.test.ts
