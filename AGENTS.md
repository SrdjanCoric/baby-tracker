# Repository agent instructions

## Durable project state

- Do not use agent memory features in this repository. Do not read from or write to auto-memory
  directories, and do not treat recalled memories as authoritative.
- This file, `plans/master-plan.md`, and task files under `plans/tasks/` are the only sources of
  durable project state.

## Active plan

- `plans/master-plan.md` is the project's single master plan for durable architectural decisions
  and ordered task pointers. Task bodies live under `plans/tasks/`.
- Add new work through the `to-plan` skill, which appends to the existing master plan and never
  creates a second one.
- Plan files are version-controlled project state. Commit each planning batch through a dedicated
  documentation PR before starting its implementation branches. Do not leave plan updates as
  long-lived working-tree changes.
- After a task PR merges, a closeout limited to changing its master-plan pointer/status and moving
  its task file to `plans/tasks/done/` must be committed directly to `main` with `[skip ci]`. Do not
  open a closeout PR or run CI for that limited closeout.
- Use a documentation PR when closeout includes broader documentation or planning changes.
- When a task has a settled HTML mock, keep the mock in the repository and link the task file to the
  exact HTML artifact it implements.

## Finish-task validation logs

- `npm run check:code` runs the production-gating bundle, where Metro/Hermes legitimately writes
  temporary files larger than 5 MiB.
- Never enforce the workflow's 5 MiB log cap with a process-wide `ulimit -f` around npm, Expo,
  Metro, or Hermes. The limit also applies to generated bundle and bytecode files and causes a false
  `EFBIG: file too large, write` failure.
- Cap only captured stdout/stderr, while continuing to drain the full stream so the producer is not
  terminated by a closed pipe. Preserve the upstream command's exit status. For zsh, use this
  pattern:

  ```sh
  set +e
  setopt pipefail
  LOG_FILE=/tmp/agent-workflows/<repo-key>/<branch-key>/canonical.log
  npm run check:code 2>&1 |
    awk 'BEGIN { max = 5 * 1024 * 1024 } { bytes += length($0) + 1; if (bytes <= max) print }' \
      > "$LOG_FILE"
  CHECK_STATUS=$pipestatus[1]
  exit "$CHECK_STATUS"
  ```

- If `EFBIG` occurs during Metro/Hermes after a process-wide file limit was applied, treat it as a
  validation-harness failure. Remove that limit and rerun the affected validation with output-only
  log limiting before diagnosing application code.
- If `npm run e2e:seed` exposes a stale local schema, run the clean household-timer gate instead of
  retrying the seed so the current migration chain is reapplied.
