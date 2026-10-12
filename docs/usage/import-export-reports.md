# Import, export and reports

## Import (Huckleberry and Nara)

- [x] [Today] Needs an account and an online, fully synced app. — test: app/settings/import.component.test.tsx
- [x] [Today] Limits: 10 MB and 20,000 rows. — test: app/settings/import.component.test.tsx
- [x] [Today] Importing the same file again skips rows already imported. — test: src/services/import/import-records.test.ts
- [x] [Today] Huckleberry rows use the phone's time zone. Nara rows use the file's Time Zone column. — test: src/services/import/huckleberry-reader.test.ts
- [x] [Today] Unsupported or still-running rows are skipped with a reason. — test: src/services/import/huckleberry-reader.test.ts
- [x] [Today] Screens reload once after an import, not once per row. — test: app/settings/import.component.test.tsx
- [ ] [Decided] Huckleberry "Mixed" bottles import as mixed. Nara rows with only a total volume import as mixed.

## Export

- [x] [Today] CSV by date range and activity type. Notes optional. — test: src/services/export-service.test.ts

## PDF report

- [ ] [Today] For the pediatrician, with optional WHO charts. Day rules follow [Statistics and timeline](stats-and-timeline.md). — weak: src/utils/report-aggregator.test.ts
