# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Memory

Do not use Claude Code's memory feature in this repository. Do not read from or write to the auto-memory directory, and do not treat recalled memories as authoritative. This file, `plans/master-plan.md`, and the task files under `plans/tasks/` are the only sources of durable project state.

## Active plan

`plans/master-plan.md` — the project's master plan (durable architectural decisions + ordered task pointers). Task bodies live in `plans/tasks/`; new work is added via the `to-plan` skill, which appends to this plan and never creates a second one.

Plan files are version-controlled project state. Commit each planning batch through a dedicated documentation PR before starting its implementation branches. Do not leave plan updates as long-lived working-tree changes. After a task PR merges, a closeout limited to changing its master-plan pointer/status and moving its task file to `plans/tasks/done/` must be committed directly to `main` with `[skip ci]`; do not open a closeout PR or run CI. Use a documentation PR if the closeout includes any broader documentation or planning changes.
