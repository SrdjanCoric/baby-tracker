# Which current coding models offer the best speed/quality ratio for TDD implementation?

## Planning decision informed

Which model and agent tier to use for TypeScript/React Native, Swift, and SQL implementation in long repository workflows with repeated RED/GREEN cycles.

## Answer

As of 2026-08-02, the strongest independent end-to-end coding-agent evidence favors **GPT-5.6 Sol** for raw speed/quality, **Grok 4.5** for quality per dollar, **Claude Opus 5** for the highest measured quality, and **Kimi K3** as the strongest currently evidenced Chinese-model contender. **GLM-5.2, Qwen3-Coder Next, Nemotron 3 Ultra, MiniMax M3, and DeepSeek V4 Flash** are attractive speed/cost candidates but need a repository-local trial because independent repository-coding evidence is weaker or harness-sensitive.

There is no official current model named “GLP” in Z.ai’s catalogue; this likely refers to **GLM**.

## Verified findings

### Independent end-to-end coding-agent evidence

Artificial Analysis’ July 2026 Coding Agent Index combines DeepSWE, Terminal-Bench v2, and SWE-Atlas-QnA, runs three attempts per task, and publishes wall time and API cost. It evaluates complete agent tuples, not models in isolation. — [Methodology](https://artificialanalysis.ai/methodology/coding-agents-benchmarking), [results](https://artificialanalysis.ai/agents/coding-agents)

| Agent tuple | Index | Mean API cost/task | Mean wall time/task |
|---|---:|---:|---:|
| Claude Code + Claude Opus 5 xhigh | 66.74 | $8.23 | 1,419 s |
| Codex + GPT-5.6 Sol max | 66.57 | $7.08 | 610 s |
| Claude Code + Claude Fable 5 max/fallback | 65.85 | $11.71 | 1,403 s |
| Grok Build + Grok 4.5 high | 64.44 | $2.59 | 992 s |
| Kimi Code CLI + Kimi K3 | 61.34 | $3.18 | 1,428 s |
| OpenCode + Muse Spark 1.1 xhigh | 53.54 | $1.43 | 755 s |
| Claude Code + GLM-5.2 | 43.18 | $6.51 | 1,505 s |
| Cursor CLI + Composer 2.5 Fast | 38.19 | $0.55 | 406 s |
| Claude Code + DeepSeek V4 Pro high | 31.44 | $0.27 | 1,072 s |
| Gemini CLI + Gemini 3.1 Pro high | 30.34 | $2.00 | 649 s |

The official Terminal-Bench 2.1 leaderboard reports Fable 5 + Claude Code at 83.8%, GPT-5.5 + Codex at 83.1%, Grok 4.5 + Cursor CLI at 79.3%, GPT-5.6 Terra + Codex at 78.4%, and Gemini 3 Pro + Terminus 2 at 73.9%. Different agents prevent model-only conclusions; within a shared agent, comparisons are more defensible. — [Terminal-Bench 2.1](https://www.tbench.ai/leaderboard/terminal-bench/2.1)

Artificial Analysis’ separate, fixed-Terminus-2 Terminal-Bench run reports GPT-5.6 Sol xhigh at 89.5%, Claude Opus 5 max at 89.1%, GPT-5.6 Terra max at 88.0%, and Kimi K3 max at 85.0%. — [AA Terminal-Bench methodology/results](https://artificialanalysis.ai/evaluations/terminalbench-v2-1)

### Chinese and open/open-weight contenders

| Model | Context | Price per M input/output tokens | Measured API output speed | Current evidence and status |
|---|---:|---:|---:|---|
| **Kimi K3** | 1.05M | $3 / $15 official | 35 tok/s AA; 76 tok/s OpenRouter median | AA Coding Agent Index 61.34; AA fixed-harness TB 85.0%; provider TB 2.1 claim 88.3%. Weights available under the conditional Kimi licence. |
| **GLM-5.2** | 1M | $1.40 / $4.40 official; cheaper routes exist | 143 AA; 158 OpenRouter | Provider claims SWE-bench Pro 62.1 and TB 2.1 81.0; independent AA agent index is only 43.18 in Claude Code. Apache-2.0 weights. |
| **Qwen3-Coder Next** | 262K, extendable | about $0.12 / $0.80 on a public route | 151 AA | Code-specific, Apache-2.0, attractive speed/price; no current comparable independent repository-agent score found. |
| **Qwen3.6-35B-A3B** | 262K, extendable | route-dependent | 154 AA | Provider reports SWE Verified 73.4, Multilingual 67.2, Pro 49.5, TB2 51.5; Apache-2.0. |
| **Nemotron 3 Ultra 550B-A55B** | 512K–1M route-dependent | about $0.60 / $3.60 public route | 186 AA | Fast open-weight agentic candidate; no comparable independent repository-coding score found. |
| **MiniMax M3** | 1M | $0.30 / $1.20 official ≤512K input | 78 AA; 110 OpenRouter | Very inexpensive; no sufficiently disclosed current M3 repository-agent result. Restrictive community licence. |
| **DeepSeek V4 Pro** | 1M | $0.435 / $0.87 official | 57 AA; 90 OpenRouter | Extremely inexpensive, but AA agent index 31.44. Tool/backend integration failures have been reported. |
| **DeepSeek V4 Flash** | 1M | $0.14 / $0.28 official; cheaper routes exist | not independently established | Speculative ultra-low-cost baseline; no trustworthy current repository-agent result. |
| **Kimi K2.7 Code Highspeed** | 256K | $1.90 / $8 official | provider claims ~180 tok/s | Code-specific lower-cost/faster Kimi option; independently verify quality and speed. |
| **MiMo-V2.5-Pro** | 1M observed | price not officially verified | 39 AA | AA broad index 42.2; insufficient independent repository-agent evidence. |
| **MiMo-V2-Flash** | 256K | not verified | not verified | Apache-2.0; provider reports SWE Verified 73.4 and Multilingual 71.7, but methodology is insufficient for ranking. |

Sources: [Kimi K3](https://github.com/MoonshotAI/Kimi-K3), [Kimi pricing](https://platform.kimi.ai/docs/pricing/chat-k3.md), [GLM-5](https://github.com/zai-org/GLM-5), [Z.ai pricing](https://docs.z.ai/guides/overview/pricing.md), [Qwen3-Coder](https://github.com/QwenLM/Qwen3-Coder), [Qwen3.6](https://huggingface.co/Qwen/Qwen3.6-35B-A3B), [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing), [MiniMax pricing](https://platform.minimax.io/docs/guides/pricing-paygo.md), [Artificial Analysis](https://artificialanalysis.ai/), [OpenRouter performance](https://openrouter.ai/api/frontend/v1/rankings/performance).

### Other proprietary contenders

- **Grok 4.5** has strong independent agent evidence: AA index 64.44 at $2.59/task, and Terminal-Bench reports 79.3% with Cursor CLI. Its API price is $2/M input and $6/M output. — [xAI models/pricing](https://docs.x.ai/developers/models), [AA coding agents](https://artificialanalysis.ai/agents/coding-agents)
- **Grok Build 0.1 / Grok Code Fast 1** is a code-specific 256K model priced at $1/M input and $2/M output. It warrants a bounded trial, but current independent evidence does not establish frontier quality. — [xAI models](https://docs.x.ai/developers/models)
- **Mistral Devstral/Codestral** remain useful code-specific and self-hosting/value options, but no current comparable independent repository-agent result was found. — [Devstral](https://docs.mistral.ai/models/model-cards/devstral-medium-1-0-25-07), [Codestral](https://docs.mistral.ai/models/model-cards/codestral-25-08)
- Amazon Nova, Meta Llama, Cohere Command, IBM Granite, Baidu ERNIE, Tencent Hunyuan, and ByteDance Seed lack enough current independent repository-agent evidence to enter the primary shortlist.

### Benchmark applicability

- SWE-bench Verified, Multilingual, and Pro evaluate repository issue-to-patch work; Pro is currently the most useful public long-horizon set, though its public tasks are now contamination-exposed. — [SWE-bench](https://www.swebench.com/), [SWE-bench Pro](https://github.com/scaleapi/SWE-bench_Pro-os)
- Terminal-Bench evaluates interactive terminal work beyond coding and is highly relevant to agents that inspect, edit, and run tests. — [Terminal-Bench](https://github.com/harbor-framework/terminal-bench-2-1)
- Aider Polyglot and LiveCodeBench mostly measure isolated edits or contest-style code generation, not long repository TDD; their current public tables are also stale for many 2026 models. — [Aider](https://aider.chat/docs/leaderboards/), [LiveCodeBench](https://github.com/LiveCodeBench/LiveCodeBench)
- A benchmark score belongs to the complete tuple of model snapshot, provider, agent scaffold, tools, reasoning effort, budget, attempts, and dataset version.

### Practitioner evidence

OpenRouter’s tagged 30-day coding/agent spend shows meaningful use of Claude, GLM-5.2, Kimi K3, and DeepSeek V4 Pro. This demonstrates adoption, not correctness. Recent GitHub issues for DeepSeek, Qwen, MiniMax, Kimi, and Devstral often concern provider adapters, streaming, timeouts, and model catalogues rather than proven model-quality failures. — [OpenRouter task spend](https://openrouter.ai/api/frontend/v1/rankings/task-spend), [OpenRouter performance](https://openrouter.ai/api/frontend/v1/rankings/performance)

## Reasonable inferences

- **Best measured raw speed/quality:** GPT-5.6 Sol. Its AA index is statistically near Opus 5 while its mean agent wall time is less than half.
- **Best measured quality per dollar among frontier results:** Grok 4.5. Its index trails the leader by only 2.3 points while costing roughly one-third as much per task.
- **Highest measured quality:** Claude Opus 5, by a very small margin over Sol; this does not imply the best wall-time or cost ratio.
- **Best-supported Chinese-model choice:** Kimi K3. It ranks fifth in the independent AA agent index and scores strongly in fixed-harness Terminal-Bench, but is slow and not cheap relative to GLM, Qwen, MiniMax, or DeepSeek.
- **Most promising cheap/fast experiment:** GLM-5.2 or Qwen3-Coder Next. GLM has strong throughput, low direct API price, and broad real-world adoption, but its independent agent result is harness-sensitive and well below its provider claims. Qwen has excellent throughput and permissive weights but insufficient independent repository evidence.
- **Ultra-cheap delegation:** DeepSeek V4 Flash, MiniMax M3, and smaller Qwen models may be suitable for reconnaissance, summarization, mechanical edits, or test-output triage, not as the default autonomous implementation model until locally validated.

## Applicability

For this TypeScript/React Native/Swift/SQL repository, run the same agent harness and effort against a fixed six-model cohort:

1. GPT-5.6 Sol — speed/quality reference;
2. Claude Opus 5 — quality reference;
3. Grok 4.5 — cost/quality candidate;
4. Kimi K3 — strongest Chinese-model evidence;
5. GLM-5.2 — low-cost/high-throughput candidate;
6. Qwen3-Coder Next — open code-specialist candidate.

Optionally add DeepSeek V4 Flash as the cost floor and Gemini 3.6 Flash as a throughput reference. Use one React Native change, one Swift/native change, one SQL/security change, and one multi-step regression. Measure first-pass acceptance, RED-before-GREEN compliance, regression count, tool-call failures, retries, total wall time, and total cost. Token throughput alone is not workflow speed.

## Unresolved uncertainty

No benchmark compares all current models under one agent, provider, reasoning effort, timeout, and task set. Dynamic prices and speeds vary by route and date. Provider claims are not directly comparable. Public benchmarks are vulnerable to contamination and scaffold optimization. Kimi and MiniMax weights require licence review. A repository-specific bake-off remains necessary before standardizing a default.

## Sources

- [Artificial Analysis Coding Agents](https://artificialanalysis.ai/agents/coding-agents) — independent agent index, cost, and wall-time snapshot, accessed 2026-08-02.
- [Artificial Analysis methodology](https://artificialanalysis.ai/methodology/coding-agents-benchmarking) — benchmark composition and attempt policy.
- [Terminal-Bench 2.1](https://www.tbench.ai/leaderboard/terminal-bench/2.1) — public operational-agent leaderboard.
- [SWE-bench](https://www.swebench.com/) — repository benchmark methodology and leaderboards.
- [SWE-bench Pro](https://github.com/scaleapi/SWE-bench_Pro-os) — public long-horizon dataset and evaluator.
- [Moonshot Kimi K3](https://github.com/MoonshotAI/Kimi-K3) — first-party model, weights, context, and provider evaluations.
- [Z.ai GLM-5](https://github.com/zai-org/GLM-5) — first-party model, weights, context, and provider evaluations.
- [Qwen3-Coder](https://github.com/QwenLM/Qwen3-Coder) — first-party code-specialist model information.
- [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing) — first-party current API catalogue and prices.
- [MiniMax pricing](https://platform.minimax.io/docs/guides/pricing-paygo.md) — first-party current API prices.
- [xAI models](https://docs.x.ai/developers/models) — first-party model catalogue, context, and prices.
- [OpenRouter task spend](https://openrouter.ai/api/frontend/v1/rankings/task-spend) — observed model adoption by tagged agent task, not quality.
- [OpenRouter performance](https://openrouter.ai/api/frontend/v1/rankings/performance) — observed route latency and throughput, not end-to-end task speed.
