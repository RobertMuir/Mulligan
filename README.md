# Mulligan Bot

> A model-agnostic AI software engineering environment that sits directly on top of a
> developer's codebase and orchestrates AI models through human-in-the-loop engineering
> process. Not an autonomous AI developer — an AI engineering team in a box, where the
> developer remains the senior engineer and final decision-maker.

<img src="assets/logo.png" alt="Mulligan, an 8-bit golf ball in a green visor holding a flag" width="160">

*If at first you fail, Take a Mulligan.*

This repository implements your new coding tool empowering engineers to develop at pace but safely!

## About the author

Mulligan is built by **Robert Muir**, a Senior Full Stack Engineer (React, React Native, TypeScript, C#/.NET, Azure, Python and applied AI). I'm looking for my next role — if your team cares about shipping AI-assisted code that people can trust, I'd like to hear from you: [github.com/RobertMuir](https://github.com/RobertMuir).

## Release Log
Version 0.1:
- Mulligan Memory
- the Coding Standards Cookbook 
- PR governance based off your Golden PRs
- Mulligan Review 
- MulliganMem Review
Finally Mulligan Bot, your agentic friendly coding terminal with model routing and a permission layer.

Also in 0.2:
- **A plugin** for Claude Code and Cursor: 24 workflow skills, 25 Mulligan principles, 2 agents and an MCP server.
- **The Karpathy principles** in every review: Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution.
- **Every model:** Claude, GPT, Gemini, OpenRouter, Mistral, Groq, Together, DeepSeek, xAI, Fireworks, and local Llama models through Ollama, llama.cpp, LM Studio or vLLM.
- **Automatic model selection**, weighted by how difficult each task is.
- **Fan-out:** when a change has more than one good shape, several subagents attack it from different angles, each candidate is verified in its own git worktree, and blind judges rank them against a private rubric. It runs on the coding agent's own subagents, so it needs no API key.
- **A baseline cookbook** written on setup: TypeScript, testing, architecture, scope guardrails and security rules drawn from the OWASP API Security Top 10, all editable by your team.
- **Sharp briefs from loose prompts:** a pasted ticket or a vague request is rewritten into a brief with a goal, scope and runnable success checks, and you approve it before any code is written.
- **Mulligan principles:** 25 short, enforceable guidelines the main mode applies and cites, written for a human-in-the-loop flow.

## Install as a plugin

This repository is its own plugin marketplace: **[github.com/RobertMuir/Mulligan](https://github.com/RobertMuir/Mulligan)** (manifest: [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json)).

**Claude Code** — add the marketplace, then install the plugin:

```text
/plugin marketplace add RobertMuir/Mulligan
/plugin install Mulligan@Mulligan
```

Then start a task with `/Mulligan:mulligan-mode <what you want done>`. To update later: `/plugin marketplace update Mulligan`.

**Cursor** — add [github.com/RobertMuir/Mulligan](https://github.com/RobertMuir/Mulligan) as a plugin; the manifest is `.cursor-plugin/plugin.json`.

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

## The Mulligan loop

Every task in **mulligan-mode** runs the same loop: understand, consult memory and the cookbook, define done as checks, plan, build, verify, review, explain, and then you decide. Mulligan states up front how the code will be written:

- **self** — the default for ordinary work: the agent writes the smallest sufficient change itself.
- **single** — a hard or large change: one subagent writes it in an isolated worktree, and the orchestrating agent reads the whole diff before applying it.
- **race** — a change with several valid shapes (no precedent in the codebase, a contested design, or an approach you rejected): several candidates compete.
- **split** — independent work such as an audit: parallel workers, one report.

Mulligan keeps an eye on cost: it reads in batches, runs the full verification once at the end, and keeps the hand-back short enough to act on.

## From a loose prompt to a sharp brief

Engineers are busy, and prompts get sloppy: a feature pasted straight from an Azure DevOps or Jira ticket, a bug described in one line, "make the export work properly". Models do their worst work on exactly those requests, because nobody said what done looks like.

When a request is a long paste or has no clear goal, scope or way to know it is finished, **mulligan-mode** stops before building and runs **prompt-engineer**:

1. It picks the template for the kind of work (feature, bug, refactor, architecture, test, security).
2. It fills it from evidence — the real files involved, your cookbook rules and Mulligan Memory — keeping your own words for the goal.
3. It turns vague acceptance into runnable checks, adds what is out of scope, and puts open questions at the top with a proposed answer for each.
4. Everything it inferred is marked, so you can see exactly what you did not say.
5. **You review the brief.** Agree, edit or reject it; only then does Mulligan build.

```text
You:      "Bug 4821: export broken for some users, customers complaining, pls fix asap"

Mulligan: Brief (please confirm or edit)
  Goal:        CSV export fails for some users (your words: "export broken for some users").
  Open (proposed answers):  Which users? → [inferred] accounts with more than 10k rows, per the error log.
  Done when:   export of a 25k-row account completes (integration test); existing export tests pass.
  Out of scope: export format, scheduling.
  Constraints: TEST-002 (failing test first), AI-001 (stay inside src/export/).
```

A short, clear request skips this step: restating it is enough. The point is that every model, from a local Llama to the strongest hosted one, gets a brief it can actually succeed with.

## Mulligan principles

The main mode works from a set of principles, each a short leaf skill (`skills/principle-*`) with the rule, why it matters, what it looks like in practice, where the developer comes in, when it does not apply, and one check. **mulligan-mode** lists them with the situation each one covers; the agent reads the principles it applies in full and names, in its hand-back, every principle that shaped a decision and what it changed.

| Group | Principles |
|---|---|
| The Karpathy four | Think Before Coding · Simplicity First · Surgical Changes · Goal-Driven Execution |
| Human in the loop | The Developer Decides · Brief Before Build · Hand Back With Evidence · Learn With Consent |
| Shape | Data First · Edges Guarded, Middle Trusted · Let the Compiler Carry It · Safe to Run Twice · Unshare Before You Lock |
| Change | Smallest Sufficient Change · Rebuild Around the Requirement · One API at a Time · Readable in Thirty Seconds · Try Two Real Shapes |
| Proof | Evidence, Not Assertion · Fix Where It Starts · One Verified Step at a Time · Tests That Can Fail · Doubt the Shared Assumption · Build the Tool |
| Economy | Spend on the Change |

The human-in-the-loop group is what sets Mulligan apart: facts are settled by the agent, decisions come to you early with a recommendation, every hand-back is labelled with its evidence, and nothing is learned without your consent.

## Attacking the Pin

1. Each candidate gets the same task from a different angle: smallest change, failure first, codebase-native, test first, rebuild around the requirement, data shape first.
2. Each candidate works in its own git worktree. Your working tree is never touched while they run.
3. Your verification commands run in each worktree.
4. Blind judges, on a different model from the orchestrator and never the model that wrote the candidate, score it against the private rubric in `.mulligan/verification/rubric.yaml`: Correctness, the four Karpathy principles, and project standards. The orchestrator scores every candidate too and explains any disagreement. Implementing models never see the rubric.
5. Hard evidence adjusts the scores: verification, size against the smallest candidate, unneeded files, tests, stated criteria and assumptions, and cookbook violations.
6. The leader is applied uncommitted; every candidate's diff is saved so you can swap. Good ideas from the losers are grafted in by hand and verified. You decide.

Candidates run on the coding agent's own subagents (Claude Code's `Agent` tool, on your existing login). Without subagents, the candidates are built one after another. Models configured in the MCP server — any provider, or local models through Ollama, llama.cpp, LM Studio or vLLM — can join the race, but nothing depends on them.

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

| | Typical coding agent | Autonomy-first agent workflows | Mulligan |
|---|---|---|---|
| Who decides | The agent, then you review | The agent proceeds on reversible work; you course-correct afterwards | The agent settles facts by experiment; **you** decide approaches, memory and commits |
| Learns your standards | No, or per session | Lessons written back into prompts or skills | `.MulliganMem` with provenance and your confirmation, a cookbook with machine checks, golden PRs |
| Standards from day one | None | Built into the workflow's own prompts | A baseline cookbook in your repo (TypeScript, testing, scope, OWASP-based security) that your team edits and Mulligan Review enforces |
| Review | Model opinion | Several models review adversarially | A deterministic evidence engine (Karpathy checks, AST cookbook rules, security, blast radius, verification), then model review on top, labelled as opinion |
| Several attempts | Retry | Parallel candidates with a cross-judge | Candidates verified in isolated worktrees, judged blind against a private weighted rubric, ranked with evidence — and only when the change genuinely has more than one good shape |
| Models | One vendor | Configured per role | Any provider or local model; fan-out runs on the agent's own subagents with no API key |
| Where it runs | Its own app | One host | Claude Code, Cursor (plugin and MCP), and a standalone terminal |
| Work that needs extra accountability | — | — | Safety review mode: traceability, change control, failure modes |

## Why Mulligan for quality-first development

Mulligan is built for code that people have to understand, sign off and maintain. What that means in practice:

- **You stay the senior engineer.** Mulligan settles facts by running things, and brings you only the decisions that are yours: approaches, trade-offs, memory and commits. Every hand-back ends with what was not verified and what is waiting on you.
- **Your standards compound.** Every accept and every Mulligan can become a lesson in `.MulliganMem`, but only when you confirm it. Lessons carry their provenance and are treated as preference, not law.
- **Standards are enforced, not suggested.** Cookbook rules with a `check:` run against the syntax tree on every review; rules without one are listed for judgement, never silently passed.
- **Evidence over assertion.** Every claim in a hand-back is labelled measured, read or inferred, and every result is PROVEN, FAILED or UNPROVEN. A test only counts if it would fail against the old code.
- **Scope is part of quality.** Changes stay inside the task. Any file outside it is named with its reason, and unrelated problems are reported rather than quietly fixed.
- **Security has a playbook.** Hardening work follows the OWASP API Security Top 10: access to every record, field-level exposure and mass assignment, roles, input validation, safe errors, resource limits — each finding proven before it is fixed.
- **Several attempts only when they pay.** A race is reserved for changes with more than one good shape, so ordinary work does not pay for three agents.
- **Cost is a design constraint.** The loop reads in batches, verifies once at the end, and keeps replies short, because tokens are a team's money.

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

**What it adds.** Every task passes through your Mulligan Memory, your cookbook and your golden PRs before any code is written, and always ends with a decision handed to you. You stay in charge of approaches without being slowed down: facts are settled by experiment, and only real decisions come to you. Seven playbooks cover investigation, bug fixes, features, security hardening, refactors, performance and prototypes.

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

**What it adds.** Every claim carries an evidence grade, so a guess never reads like a finding. If you are about to change the code, it ends with Preserve / Free to change / Avoid / Risk constraints that feed straight into **architect**.

### swing-analysis — teaching

**Use it when** you want to genuinely understand a change, subsystem or concept, not just receive a summary.

```text
/swing-analysis how does the fan-out rubric decide a winner?

(A two-sentence answer first, then diagrams that add one part at a time, at your pace.)
```

**What it adds.** Gaps you uncover can become steps in your personal upskilling plan (**mulligan-memory-review**). Preferences you arrive at can become Mulligan Memory candidates.

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

**Use it when** a change has more than one good shape and one attempt would lock in the first idea.

```text
/attacking-the-pin --n 3 add idempotent retries to the payment webhook

#  Cand  Angle                 Model     Verified  Correct Simple Surgic Goal  Weighted
1  B     Failure first         claude    passed    4.5     4.0    4.0    5.0   84
2  A     Smallest change       llama-70b passed    3.5     5.0    5.0    3.5   78
3  C     Rebuild around req.   gpt       FAILED    2.0     2.5    3.0    2.0   31  FAILED VERIFICATION
Recommended: B. /pick B, then /apply.
```

**What it adds.** Each candidate is applied in an isolated git worktree and your real checks run there. Judges never see which model wrote a candidate and never judge their own. The rubric is private: implementers never see it. Every score adjustment is shown. **mulligan-mode** starts a race on its own when a change has no precedent, a contested design, or follows an approach you rejected.

### take-a-mulligan

**Use it when** you reject an approach, and the next attempt should be genuinely different, not a tweak.

```text
/take-a-mulligan too much abstraction for a single screen

Lesson proposed (candidate): "Prefer direct code over layers until a second use exists."  [Accept / Reject / Modify]
Difficulty +10 → routed to a stronger model. Fanning out with the rejected approach off limits…
```

**What it adds.** The rejection reason becomes a candidate memory lesson, the model escalates, the retry races several genuinely different approaches, and none of them may be a variation of what you rejected. The skill must always be able to answer one question: *what did we learn from the last attempt?*

### bunker-buster — the last resort

**Use it when** everything has failed, including Mulligan mode, repeated Mulligans and your own ideas, and you have nothing left to lose. Call it yourself at any time. Mulligan mode also takes it automatically, once per task: when two attempts fail on the same assumption and nobody can say why, or when a tier-5 problem has failed a full attempt.

```text
/bunker-buster checkout total is off by a cent under load

Shared assumption: the rounding bug is in our code. Thrown out → the shot: read the payment SDK's rounding.
Shot taken once in .mulligan/sessions/bunker/checkout-cent · goal check: PASS → Landed.
Patch saved. Build on it? It goes back through mulligan-mode only if you say so.
```

**What it adds.** One all-out shot, built on the opposite of the assumption every failed attempt shared. It runs on the strongest model in an isolated worktree, makes no fix rounds, and stops after one try. It usually misses. A miss can still disprove the assumption that kept you stuck. It never commits, pushes or deploys, and its patch goes no further unless you say so.

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

### mulligan-memory-review

**Use it when** you want to see what you are good at, where your gaps are, and a plan to close them.

```text
/mulligan-memory-review
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

## Make it yours

Mulligan is a set of plain files, and every part of the workflow is meant to be changed to suit your team:

| To change | Where |
|---|---|
| How many agents attack a problem, and whether races start automatically | `loop.fanout` in `.mulligan/config.yaml` (`auto`, `count`, `judges`, `verify`) |
| When Mulligan delegates, races or writes code itself | step 5 of `skills/mulligan-mode/SKILL.md` |
| The playbooks for each kind of work (add your own: a release, a data migration, an incident) | `skills/mulligan-mode/playbooks/` |
| The principles the main mode applies | `skills/principle-*/SKILL.md` — edit, remove, or add your own and list it in **mulligan-mode** |
| How loose prompts become briefs | `skills/prompt-engineer/` and its templates |
| Your coding standards and their machine checks | `.mulligan/cookbook/*.yaml`, or the **setup-mulligan-cookbook** interview |
| How race candidates are scored | `.mulligan/verification/rubric.yaml` (private, local) |
| Which models do which job, and how difficulty is weighted | `models` in `.mulligan/config.yaml`, `/models`, `models.routing.weights` |
| What proves the app works | `verification.commands`, or **create-verification-skill** |

If something does not suit the way you work, fork it and adapt it. That is what the MIT license is for.

## Packages

| Package | Contents |
|---|---|
| `@mulligan/core` | Standards hierarchy, 15 provider kinds, capability catalog, difficulty weighting, manual and automatic routing, local discovery, code context, workspace, git |
| `@mulligan/memory` | `.MulliganMem`, provenance, human-confirmation loop, extraction, conflicts, applicability, export and import, MulliganMem Review |
| `@mulligan/cookbook` | Cookbook parser, TypeScript-AST rule engine, interview, baseline rules |
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

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 Robert Muir.
