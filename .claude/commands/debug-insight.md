---
description: Document a debugging session — what the problem was and how it was solved
argument-hint: <brief-problem-description>
allowed-tools: Read, Grep, Glob, LS, Bash(find:*), Bash(mkdir:*), Write
---

# Debug Insight

Document the problem you just debugged and how it was solved, then save it to the debug-insights folder.

## Steps

1. Create the debug-insights folder if it doesn't exist
```bash
mkdir -p debug-insights
```

2. Gather context
- Ask the user (or review recent conversation) for:
  - What was the symptom / error?
  - What was the root cause?
  - How was it fixed?
  - Any key files or lines involved?

3. Write the document to `debug-insights/<date>-<short-slug>.md` with this structure:
```
# <Problem Title>

**Date:** YYYY-MM-DD
**Files involved:** `path/to/file.ts`, ...

## Symptom
What was observed — error messages, unexpected behavior, failing tests.

## Root Cause
Why it happened — the actual bug or misconfiguration.

## Fix
What was changed and why.

## Lessons / Notes
Anything worth remembering for next time.
```

4. Confirm the file was written
```bash
find debug-insights -name "*.md" -newer /tmp/ -maxdepth 1
```