# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Memory

Do not use Claude Code's memory feature in this repository. Do not read from or write to the auto-memory directory, and do not treat recalled memories as authoritative. This file, `plans/master-plan.md`, and the task files under `plans/tasks/` are the only sources of durable project state.

## Active plan

`plans/master-plan.md` — the project's master plan (durable architectural decisions + ordered task pointers). Task bodies live in `plans/tasks/`; new work is added via the `to-plan` skill, which appends to this plan and never creates a second one.

Plan files are version-controlled project state. Do not leave plan updates as long-lived working-tree changes.

Documentation-only changes (planning batches, briefs, task files, master-plan edits, README/docs updates) do not go through a PR, CI, or `sync-main`. Commit them directly to `main` with `[skip ci]` in the commit message and push. This includes task closeouts: after a task PR merges, commit the pointer/status change and the move of its task file to `plans/tasks/done/` directly to `main` with `[skip ci]`. PRs, CI, and `sync-main` are for code changes only.
