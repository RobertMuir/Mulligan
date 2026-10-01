# Mulligan Bot

> A model-agnostic AI software engineering environment that sits directly on top of a
> developer's codebase and orchestrates AI models through human-in-the-loop engineering
> process. Not an autonomous AI developer — an AI engineering team in a box, where the
> developer remains the senior engineer and final decision-maker.

<img src="assets/logo.png" alt="Mulligan, an 8-bit golf ball in a green visor holding a flag" width="160">

*If at first you fail, Take a Mulligan.*

This repository implements your new coding tool empowering engineers to develop at pace but safely!

Version 0.1:
- Mulligan Memory
- the Coding Standards Cookbook 
- PR governance based off your Golden PRs
- Mulligan Review 
- MulliganMem Review
Finally Mulligan Bot, your agentic friendly coding terminal with model routing and a permission layer.

Also in 0.1:
- **A plugin** for Claude Code and Cursor: 23 skills, 2 agents and an MCP server.
- **The Karpathy principles** in every review: Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution.
- **Every model:** Claude, GPT, Gemini, OpenRouter, Mistral, Groq, Together, DeepSeek, xAI, Fireworks, and local Llama models through Ollama, llama.cpp, LM Studio or vLLM.
- **Automatic model selection**, weighted by how difficult each task is.
- **Fan-out:** N models attack a problem from different angles, each candidate is verified in isolation, and blind judges rank them against a private rubric.

## Install as a plugin

**Claude Code**

```text
/plugin marketplace add <path-or-git-url-of-this-repo>
/plugin install Mulligan@Mulligan
```

**Cursor** — add this repository as a plugin; the manifest is `.cursor-plugin/plugin.json`.

The plugin ships the skills in `skills/`, the agents in `agents/`, and the `Mulligan` MCP server (`dist/mcp-server.mjs`, self-contained; only Node 20+ is needed). Start with the **setup-mulligan** skill, then use **mulligan-mode** for real work.

MCP tools: `mulligan_review`, `mulligan_mem_review`, `mulligan_fanout`, `route_task`, `memory_list`, `memory_propose`, `memory_decide` (requires the developer's explicit decision), `cookbook_check`, `models_discover`.

## Run the terminal

```bash
pnpm install
pnpm build            # logos + dist/ bundles
node dist/Mulligan.mjs            # interactive, from any project directory
```

One-shot commands:

```bash
Mulligan setup-mulligan          # .mulligan/, .MulliganMem, private rubric, .gitignore
Mulligan review --task "…"       # Mulligan Review of the current branch
Mulligan mem-review              # MulliganMem Review + upskilling plan
Mulligan route "<task>"          # difficulty and the model each role gets
Mulligan fanout --n 3 "<task>"   # several models, verified and ranked
Mulligan models discover         # find local models
```

## Models

Keys always come from environment variables; nothing is written to files.

```text
/models add claude anthropic claude-opus-5-5          # ANTHROPIC_API_KEY
/models add gpt openai <model-id>                     # OPENAI_API_KEY
/models add llama ollama llama3.1:8b                  # local, no key
/models add any openai-compatible <model> KEY_ENV https://host/v1
/models discover                                      # Ollama, llama.cpp, LM Studio, vLLM
```

**Local models.** Ollama, llama.cpp (`llama-server`), LM Studio and vLLM are built in and found automatically on their default ports. They need no key, cost nothing per token, and keep code on the machine. Any other server that speaks the OpenAI chat API works through `openai-compatible`, and OpenRouter reaches hundreds of hosted models. Providers that only offer their own non-OpenAI API (for example AWS Bedrock or Vertex AI directly) need a gateway such as LiteLLM or OpenRouter in front of them.

**Automatic selection.** `/models routing auto` scores every task for difficulty from named factors: architecture, concurrency, security, data integrity, performance, number of files, Safety mode, the role, and each Mulligan already taken. It then picks the cheapest ready model whose capability meets that difficulty. Repeated Mulligan escalate to stronger models. `/route <task>` shows every factor and the choice. Weights live in `models.routing.weights`, capabilities can be corrected with `/models capability`, and `--prefer-local` uses local models whenever they are capable enough.

## The Mulligan loop and fan-out

`/implement` and `/take-a-mulligan` fan out automatically when a task is hard enough (`loop.fanout` in config, default difficulty 60, 3 candidates):

1. Each model gets the same task from a different angle: smallest change, failure first, codebase-native, test first, rebuild around the requirement, data shape first.
2. Each candidate is applied in its own temporary git worktree that carries your uncommitted work. Your working tree is never touched.
3. Your verification commands run in each worktree.
4. Blind judges, never the model that wrote the candidate, score it against the private rubric in `.mulligan/verification/rubric.yaml`: Correctness, the four Karpathy principles, and project standards. Implementing models never see the rubric.
5. Hard evidence adjusts the scores: verification, size against the smallest candidate, unneeded files, tests, stated criteria and assumptions, and cookbook violations.
6. You get a ranking with every reason shown. `/pick` and `/apply` use the git-generated diff. You decide.

## What lives where

```text
project/
├── .MulliganMem          "What have we learned?"  — human-readable YAML, LOCAL ONLY
└── .mulligan/            "How does Mulligan operate?"
    ├── config.yaml       models, routing, fan-out, verification, approved commands  (commit)
    ├── cookbook/         team coding standards                                      (commit)
    ├── golden-pr/        golden examples, observed principles, metadata             (commit)
    ├── architecture/                                                                (commit)
    ├── verification/     private rubric                                             (local)
    ├── memory/           memory change history                                      (local)
    ├── sessions/         transcripts, attempts, fan-out candidates                  (local)
    └── audit/            command audit log, saved reviews                           (local)
```

`.MulliganMem` is git-ignored and stays on your machine. Share it with `/memory export` and `/memory import`. Imports arrive as candidates, never as trusted principles.

## How Mulligan compares

Mulligan takes teachings from some of the greatest minds in AI, such as Andrej Karpathy's principles for working with coding models. It adapts them for software where humans must stay accountable: code that people have to understand, sign off and maintain. The human is not a reviewer bolted on at the end of an agent's run. They stay inside the agentic loop, and every decision they make teaches the system. The result is a **hybrid human–agentic flow**: agents do the exploring, building and proving, and the human remains the senior engineer and the final decision-maker.

| | Typical coding agent | Rigour-first skill packs (e.g. pstack) | Mulligan |
|---|---|---|---|
| Who decides | The agent, then you review | The agent proceeds on reversible work; you course-correct afterwards | The agent settles facts by experiment; **you** decide approaches, memory and commits |
| Learns your standards | No, or per session | Captures lessons as skill edits (`/reflect`) | `.MulliganMem` with provenance and your confirmation, a cookbook with machine checks, golden PRs |
| Review | Model opinion | Several models review adversarially | A deterministic evidence engine (Karpathy checks, AST cookbook rules, security, blast radius, verification), then model review on top, labelled as opinion |
| Several attempts | Retry | Parallel candidates with a cross-judge | Candidates verified in isolated worktrees, judged blind against a private weighted rubric, ranked with evidence, triggered automatically by difficulty |
| Models | One vendor | Cursor's models, configured per role | Any provider or local model; automatic selection by task difficulty |
| Where it runs | Its own app | Cursor | Claude Code, Cursor (plugin and MCP), and a standalone terminal |
| Work that needs extra accountability | — | — | Safety review mode: traceability, change control, failure modes |

Where pstack goes further today:
- 23 playbooks against Mulligan's 6.
- A `why` investigator that fans out across seven kinds of MCP evidence source.
- Deep Cursor-native orchestration (cloud agents, PR babysitting, shipping).

Mulligan's bet is different. It wants the most trusted result, with the human's judgement captured and compounding, in places where code quality is not optional.

## Skills

Every skill is invoked by name (for example `/take-a-mulligan` in Claude Code). The examples show the shape of a real exchange. They are shortened, and the file names in them are made up.

### mulligan-mode — the way of working

**Use it when** you start any non-trivial task and want the whole loop: understand, consult memory, define done, explore, implement, verify, review, explain, then you decide.

```text
/mulligan-mode Add offline support to the appointment list.

Assumptions: offline = read-only cache; sync on reconnect. Is offline editing in scope?
Memory: MM-004 "Prefer local state…" applies. MM-009 may not (task crosses screens): flagged.
Done when: list renders from cache in airplane mode (e2e), cache invalidates on login change (unit).
Playbook: Feature → architect (2 shapes) → implement → verify → mulligan-review.
Decisions waiting on you: offline edits? cache size limit?
```

**What it adds.** Every task passes through your Mulligan Memory, your cookbook and your golden PRs before any code is written. It always ends with a decision handed to you. pstack's mode lets the agent proceed on reversible work and asks you to course-correct afterwards. This one keeps you in charge of approaches without slowing you down. Facts are settled by experiment; only real decisions come to you.

### architect

**Use it when** a change crosses a function or module boundary and getting the shape wrong would be expensive.

```text
/architect a retry policy for the sync queue

Usage first: await queue.enqueue(job, { retry: 'idempotent' })
Design A: retry inside each job (small, but every job re-implements backoff)
Design B: a policy table keyed by job kind (one place, testable)   ← recommended
Checks: B hides backoff and jitter behind one option; A leaks them to every caller.
Waiting for your agreement before implementing.
```

**What it adds.** It waits for your agreement on the shape before implementing, because the shape is a one-way door. Candidate designs can come from different models through a fan-out. The rationale records which Mulligan principles each design honours.

### digging-it-out-of-the-dirt — blast radius

**Use it when** a small diff makes you nervous: what could it break outside its own lines?

```text
/digging-it-out-of-the-dirt the cache eviction change in src/cache/evict.ts

Load-bearing fact: evict() only removes entries whose ttl < now.
Proof (Executed): scripts/evict-check.ts calls the real evict() on 10k fixtures. 0 live entries removed.
Risk: the analytics worker reads the same Redis keys (worker/stats.ts:41). Likely low, impact medium.
Cleared: the UI cache (separate namespace, src/ui/cache.ts:12).
```

**What it adds.** It starts from Mulligan Review's deterministic blast-radius and surgical-change evidence. Every claim is graded on a ladder from *Claimed* to *Reproduced*, and the one fact the change's safety rests on must be proven by running code.

### divot-analysis — large or unfamiliar work

**Use it when** no playbook fits: a migration across 80 call sites, a sweeping change, or work you will review after stepping away.

```text
/divot-analysis migrate every caller from legacyStore to asyncStore

Done = 0 imports of legacyStore, module deleted, full suite green.
Scope: 83 call sites across 4 packages. Rigour: high (data path).
Plan: codemod + per-package check, riskiest package first. Agree before I start?
Decision log: .mulligan/sessions/<id>/decisions.tsv
```

**What it adds.** You agree the framing before a long run starts. Every unit ends PROVEN, FAILED or UNPROVEN, and the decision log lives in the session folder, ready to attach to the PR.

### how

**Use it when** you need to understand how part of the system works before changing it, or where new code should live.

```text
/how does sync handle conflicts?

Overview · Key pieces · How it works (syncQueue.flush() → api.post() → mergeServerState()) · Where things live · Surprises
```

**What it adds.** Placement questions are answered against your recorded architecture preferences and cookbook rules, not only the code.

### reading-the-flight — why code is the way it is

**Use it when** you want the reason behind a design, a threshold or a defensive check, usually before changing it.

```text
/reading-the-flight why is the upload timeout 45 seconds?

Established: PR #412 "raise timeout — mobile uploads stall >30s on weak networks" (Stated).
Likely: the retry count of 3 matches the client SDK default (Interpreted).
Unknown: why 45 rather than 60. Ask @author.
Preserve: ≥45s. Avoid: lowering it (incident INC-88).
```

**What it adds.** Every claim carries an evidence grade, so a guess never reads like a finding. If you are about to change the code, it ends with Preserve / Free to change / Avoid / Risk constraints that feed straight into **architect**. pstack's `why` grades confidence too, and searches a wider set of sources. Mulligan's version is narrower but feeds its constraints into the design step.

### swing-analysis — teaching

**Use it when** you want to genuinely understand a change, subsystem or concept, not just receive a summary.

```text
/swing-analysis how does the fan-out rubric decide a winner?

(A two-sentence answer first, then diagrams that add one part at a time, at your pace.)
```

**What it adds.** Gaps you uncover can become steps in your personal upskilling plan (**mulliganmem-review**). Preferences you arrive at can become Mulligan Memory candidates.

### interrogate

**Use it when** you want a diff stress-tested by several independent reviewers on different models.

```text
/interrogate

Reviewers: claude (6 findings), gpt (4), llama-70b (3)
Fix now: race in sync/flush.ts:88, raised by all three.
Weigh: extract a retry helper? (one reviewer)
Rejected: "add null check at parse.ts:12". The type already excludes null.
```

**What it adds.** Every reviewer gets Mulligan Review's evidence and the Karpathy lens, and reviewers can come from any provider, local models included. Rejected findings stay visible, with reasons, so you can overrule the verdict.

### attacking-the-pin — fan-out

**Use it when** a task is hard or contested and one attempt would lock in the first idea.

```text
/attacking-the-pin --n 3 add idempotent retries to the payment webhook

#  Cand  Angle                 Model     Verified  Correct Simple Surgic Goal  Weighted
1  B     Failure first         claude    passed    4.5     4.0    4.0    5.0   84
2  A     Smallest change       llama-70b passed    3.5     5.0    5.0    3.5   78
3  C     Rebuild around req.   gpt       FAILED    2.0     2.5    3.0    2.0   31  FAILED VERIFICATION
Recommended: B. /pick B, then /apply.
```

**What it adds.** Each candidate is applied in an isolated git worktree and your real checks run there. Judges never see which model wrote a candidate and never judge their own. The rubric is private: implementers never see it. Every score adjustment is shown. Fan-out also starts on its own when a task's difficulty crosses your threshold.

### take-a-mulligan

**Use it when** you reject an approach, and the next attempt should be genuinely different, not a tweak.

```text
/take-a-mulligan too much abstraction for a single screen

Lesson proposed (candidate): "Prefer direct code over layers until a second use exists."  [Accept / Reject / Modify]
Difficulty +10 → routed to a stronger model. Fanning out with the rejected approach off limits…
```

**What it adds.** pstack has no direct equivalent; its closest is the attack-the-premise principle. Here, the rejection reason becomes a candidate memory lesson, the model escalates, and the retry is guaranteed to differ. The skill must always be able to answer one question: *what did we learn from the last attempt?*

### tdd

**Use it when** you are fixing a bug that lives in code that is quick to test.

```text
/tdd discount rounds 9.995 down
Failing first: total.test.ts › rounds half up. Expected 1000, received 999.
Fix: Math.round on pence (total.ts:4). Passing after: 1 test, 0 failures.
```

**What it adds.** It works with Mulligan Review's Goal-Driven check. A test that would still pass with every import stubbed out doesn't count.

### reflect

**Use it when** a long session ends and its lessons should outlive it.

```text
/reflect
Proposed: cookbook rule ARCH-004 with a check (no fetch() outside src/api/).
Proposed: memory candidate "Mock only the network boundary".
Dropped: "use pnpm" (one-off). Nothing is applied without you.
```

**What it adds.** Each lesson goes to the strongest place that will hold it: a type, a cookbook check, a memory candidate, or a skill edit. Lessons don't pile up as prose.

### mulligan-review

**Use it when** you are about to open a PR.

```text
/mulligan-review --task "apply a 10% discount" --description-file PR.md

KARPATHY PRINCIPLES
⚠ SIMPLICITY FIRST     New abstraction `DiscountStrategyFactory` has a single use
⚠ SURGICAL CHANGES     3 changed lines differ only in whitespace (src/auth/session.ts)
✓ GOAL-DRIVEN EXECUTION 1 test file changed; 2 verification checks passed
TYPESCRIPT  ✗ TS-001 violated — Avoid any (src/cart/total.ts:4)
Unverified: production runtime behaviour.  Never a score.
```

**What it adds.** The evidence engine is deterministic, so the same diff gets the same findings. All four Karpathy principles appear on every review. Your cookbook rules are enforced from the code's syntax tree, and anything unchecked is listed as unverified, not passed.

### mulliganmem-review

**Use it when** you want to see what you are good at, where your gaps are, and a plan to close them.

```text
/mulliganmem-review
✓ Explicit error handling: 41 catch sites, none empty
1. Runtime validation: fetch() results trusted at runtime (src/api/user.ts:12). Not yet in your memory.
UPSKILLING PLAN: learn → review patterns → refactor src/api/user.ts → write tests → /mulligan-review → add the principle
```

**What it adds.** An educational loop built on your own code and history, with evidence for every point. It is not a grade.

### setup-mulligan · setup-mulligan-cookbook · setup-mulligan-pr

**Use them when** you first adopt Mulligan:
- **setup-mulligan** connects cloud or local models, chooses manual or automatic routing, and sets verification commands and the rubric.
- **setup-mulligan-cookbook** interviews you and your team to produce enforceable standards.
- **setup-mulligan-pr** connects GitHub or GitLab, learns from 3–10 golden PRs, and mines reviewer comments.

```text
/setup-mulligan-cookbook
What patterns do you prohibit in TypeScript? → "barrel files; enums"
→ TS-002 Do not use: barrel files (high) · TS-003 Do not use: enums (high)
```

**What it adds.** Your standards in your words, enforced on every review and fed into every prompt. Golden PR patterns are reported as "seen in 4/5 of your examples", never as universal truth.

### create-verification-skill · maintain-verification-skill

**Use them when** nothing in the repo can prove the app actually works, or when the existing proof has drifted.

```text
/create-verification-skill
Interface: web UI (Vite, :5173) · Harness: Playwright (existing) · Proof: screenshots + DB rows
Wrote .claude/skills/verify-app/ · ran it once end to end · added `npm run e2e:smoke` to verification.commands
```

**What it adds.** Scriptable proof is wired into `verification.commands`. From then on, every Mulligan Review and every fan-out candidate is checked against it automatically.

### prompt-engineer

**Use it when** you are handing work to another model and want a brief it cannot misread.

```text
/prompt-engineer (bug template)
Symptom · Reproduction · Known so far · Do (reproduce, failing check, fix at cause) · Success checks · Out of scope
```

**What it adds.** Six templates (feature, bug, refactor, architecture, test, security) are filled from your cookbook and memory. The private rubric is never leaked into the brief.

### technical-writing · stroke-play

**Use them when** you are writing docs, PR descriptions or commit messages (**technical-writing**), and to strip machine-written padding from any prose (**stroke-play**).

```text
/stroke-play "This robust solution seamlessly leverages our cutting-edge cache to enhance performance."
→ "The cache cuts p95 latency from 220 ms to 40 ms."
```

**What it adds.** PR descriptions follow the sections your golden PRs actually use. Otherwise these are close to other good writing guides, applied every time.

### typescript-best-practices

**Use it when** you are reading or editing `.ts` or `.tsx` files.

**What it adds.** Each practice links to an enforceable cookbook check (`no-explicit-any`, `no-non-null-assertion`, …) with documented exceptions (`// mulligan-allow TS-001: <reason>`). Mulligan's own source code follows these rules: no `any`, no non-null assertions, no unchecked casts of untrusted data.

## Packages

| Package | Contents |
|---|---|
| `@mulligan/core` | Standards hierarchy, 15 provider kinds, capability catalog, difficulty weighting, manual and automatic routing, local discovery, code context, workspace, git |
| `@mulligan/memory` | `.MulliganMem`, provenance, human-confirmation loop, extraction, conflicts, applicability, export and import, MulliganMem Review |
| `@mulligan/cookbook` | Cookbook parser, TypeScript-AST rule engine, interview, starter rules |
| `@mulligan/pr` | PR providers (GitHub, GitLab), golden PR analysis, review-comment learning |
| `@mulligan/review` | Mulligan Review with the Karpathy principles, cookbook, memory, golden PRs, security, blast radius, verification, Safety mode |
| `@mulligan/orchestrator` | Fan-out: angles, sandboxed worktrees, blind judges, private rubric, evidence scoring, ranking |
| `@mulligan/mcp` | The MCP server behind the plugin |
| `@mulligan/bot` | The `Mulligan` terminal, commands, permission layer |
| `@mulligan/mascot` | The 8-bit mascot as one pixel grid, rendered to SVG, PNG and the terminal |

## Build

```bash
pnpm build:brand     # assets/logo.svg, assets/logo.png, packages/mascot/assets/ from the pixel grid
pnpm build:plugin    # dist/mcp-server.mjs and dist/Mulligan.mjs
pnpm test
pnpm typecheck
```

## Not yet built

- The desktop app and installer.
- An agent loop that edits files through tools. Implementations are proposed as full files, verified in sandboxes, and applied on `/apply`.
- Bitbucket and Azure DevOps PR providers. The interface is ready.
