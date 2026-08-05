# What is the easiest cross-agent tool for finding why the TDD workflow is slow?

## Planning decision informed

Which low-friction measurement tool to use across Codex and Claude Code before changing the
repository's implementation, review, or validation workflow.

## Answer

Start with **[CodeBurn](https://github.com/getagentseal/codeburn#readme)**. It is the easiest useful
baseline: `npx codeburn` reads the existing local session histories of both Codex and Claude Code,
requires no wrapper, proxy, account, or API key, and reports testing/shell activity, tool mix,
one-shot rate, retry rate, self-correction, context/cache waste, tokens, cost, and Git-correlated
delivery yield. It is free, MIT-licensed, and local-only.

Do **not** begin by building an OpenTelemetry dashboard. Add native OpenTelemetry with a local
[Grafana LGTM](https://github.com/grafana/docker-otel-lgtm#readme) backend only if CodeBurn cannot
distinguish whether the delay comes from model latency, test execution, approval waiting, or retry
loops. OTel is more precise but takes more setup and provider-specific queries.

## Verified findings

- CodeBurn runs without installation via `npx codeburn`, reads session files already on disk, and
  says that no wrapper, proxy, API key, or upload is involved. Its browser dashboard also binds to
  localhost. — [CodeBurn quick start and privacy](https://github.com/getagentseal/codeburn#quick-start)
- Claude Code and Codex are first-class CodeBurn inputs. It reads Claude's project JSONL files and
  Codex's dated and archived rollout JSONL files, extracting token, tool, timestamp, shell-command,
  and project data where the provider records it. — [CodeBurn data sources](https://github.com/getagentseal/codeburn#how-it-reads-your-data)
- CodeBurn deterministically classifies `pytest`, `vitest`, and `jest` shell use as Testing. Its
  activity reports include shell/tool breakdowns, while `compare` reports one-shot rate, retry
  rate, self-correction, cost per edit, tokens, cache hit rate, delegation, planning, and tools per
  turn. — [CodeBurn task categories and comparison](https://github.com/getagentseal/codeburn#task-categories)
- CodeBurn defines an edit retry as re-editing the same file after an intervening shell command. Its
  `yield` command correlates sessions and Git commits into productive, reverted, abandoned, or
  ambiguous categories using timestamp windows. Both are documented heuristics, not correctness
  proofs. — [CodeBurn one-shot methodology](https://github.com/getagentseal/codeburn#one-shot-rate),
  [yield methodology](https://github.com/getagentseal/codeburn#track-what-shipped)
- Codex natively exports OTel structured events and metrics for conversation starts, API attempts,
  request/stream duration, token counts, tool decisions, tool duration, and tool success. Prompt
  text is redacted unless explicitly enabled. — [OpenAI Codex observability](https://learn.chatgpt.com/docs/config-file/config-advanced#observability-and-telemetry)
- Claude Code natively exports OTel metrics, events, and beta traces. Traces separate whole-turn
  time, LLM time and retry attempts, tool execution, and time blocked on user permission. With
  `OTEL_LOG_TOOL_DETAILS=1`, Bash command details can identify individual test runs; prompts and
  tool details are redacted by default. — [Anthropic Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage)
- Grafana's `grafana/otel-lgtm` container bundles an OTel Collector, Prometheus, Tempo, Loki, and
  Grafana as a local development/testing backend. — [Grafana LGTM](https://github.com/grafana/docker-otel-lgtm#readme)

## Reasonable inferences

- CodeBurn is the best first step because it can analyze history immediately and directly surfaces
  likely workflow waste: repeated edit-test-edit loops, excessive reconnaissance, context churn,
  unnecessary delegation, or an expensive model handling small turns.
- The current workflow should be measured as separate phases: implementation/TDD, task review,
  review remediation, final proof/CI, and merge. Calling the entire elapsed time "TDD" would hide
  review-loop or CI delays. The workflow already asks agents to report individual command durations,
  but its task logs are temporary and removed after successful synchronization, so it lacks a
  durable cross-task timing series.
- A small external outcome record remains necessary. Tool success only proves that a command exited
  successfully; CodeBurn's Git correlation only suggests that work shipped. Neither proves the task
  met its acceptance criteria without later rework.

## Applicability

The installed tools are Codex CLI `0.146.0`, Claude Code `2.1.222`, and Node `26.5.0`, which exceeds
CodeBurn's documented Node `22.13+` requirement. This machine currently has 140 files under the
Codex session directory and 335 under Claude's project-history directory, so a historical baseline
is available immediately.

Use this smallest evaluation:

1. Run `npx codeburn doctor`, then `npx codeburn web -p 30days` from this repository.
2. Inspect `codeburn optimize -p 30days`, `codeburn compare -p 30days`, and
   `codeburn yield -p 30days` before changing the workflow.
3. For the next 8–12 comparable tasks, use one fresh agent session per task and put the task ordinal
   in the first prompt.
4. Record four external fields per task: start time, accepted/merged time, CI result, and whether
   review required substantive rework. Compare these against CodeBurn's provider, model, Testing,
   retry, tool, token, and yield data.
5. Only if the bottleneck remains ambiguous, enable native OTel for 5–10 representative tasks and
   send it to local Grafana LGTM. Keep prompt, tool-content, and raw-API-body logging disabled.

## Unresolved uncertainty

- CodeBurn does not document exact task or per-test-command elapsed durations. Its retry and Git
  yield measures are directional heuristics.
- Local transcript formats can change between Codex or Claude Code releases; run `codeburn doctor`
  before trusting a comparison.
- Codex and Claude OTel schemas are not identical. A shared backend does not automatically create a
  fair dashboard, and Codex's documented metrics identify the internal tool category more readily
  than the exact shell command.
- No evaluated tool independently proves acceptance-criteria success or attributes later production
  defects to a session.

## Sources

- [CodeBurn README](https://github.com/getagentseal/codeburn#readme) — project-owned documentation,
  current 2026-08-05; setup, inputs, metrics, heuristics, privacy, and license.
- [OpenAI Codex advanced configuration](https://learn.chatgpt.com/docs/config-file/config-advanced#observability-and-telemetry) — official current Codex OTel configuration and emitted data.
- [Anthropic Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage) — official
  current Claude Code OTel metrics, events, traces, attributes, and privacy gates.
- [Grafana LGTM](https://github.com/grafana/docker-otel-lgtm#readme) — official Grafana local OTel
  backend, intended for development and testing.
