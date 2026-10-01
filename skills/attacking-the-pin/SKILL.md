---
name: attacking-the-pin
description: Fan a task out to several models at once — each attacking it from a different angle — apply and verify every candidate in its own isolated worktree, have blind judges score each one against the private rubric, and rank them with evidence for the developer to choose. Also splits large checks across parallel workers. Use for /attacking-the-pin, /fanout, "try several approaches", "compare models", or a change with several valid shapes.
---

# Attacking the pin

*In golf terms for fanning a problem out to several models and ranking the results.*

One attempt at a hard problem locks in whatever shape came first. A swarm gets several genuinely different attempts, checks each against reality, and lets evidence and a rubric — not the loudest answer — decide the ranking. The developer picks.

Mulligan races when the change admits several valid shapes — no precedent, a contested design, an approach the developer rejected, or the developer asks (**mulligan-mode**, step 5) — unless `loop.fanout.auto` is `false`. A clear target gets one delegate, not a race.

## Two shapes

- **Race** — several candidates for the *same* task, ranked. This is the default and what the rest of this skill describes.
- **Split** — one large job divided into slices (one package, one feature, one file set per worker), each worker reporting PASS, ISSUES or BLOCKED with evidence, combined into one report. Use it for audits and wide checks. A slice with no result is a gap, not a pass. Slices go to read-only `mulligan-reviewer` workers; when the audit leads to fixes, make them yourself as one coherent change.

## Who does the work

Fan-out needs no API key and no MCP server. Use the first of these that is available, and say in your reply which one ran:

1. **Host subagents** — the coding agent's own parallel workers, on the developer's existing login. In Claude Code: the `Agent` tool (named `Task` in some versions) with `subagent_type` `mulligan-agent` for candidates and `mulligan-reviewer` for judges and split slices (named `Mulligan:mulligan-agent` and `Mulligan:mulligan-reviewer` when Mulligan is installed as a plugin), all started in one message so they run together. Spread candidates across the models the host offers (Claude Code: `model: opus`, `sonnet`), strongest first; at difficulty tier 4–5 give every candidate the strongest.
2. **Sequential** — no subagent mechanism: build each candidate yourself, one after another, each in its own worktree.
3. **Mulligan MCP models (optional)** — when the `mulligan_fanout` tool is connected with a provider key or a local model (Ollama, llama.cpp, LM Studio, vLLM), its candidates join the race. Nothing depends on it.

If a race was chosen and cannot run, say so; never drop to one attempt silently.

## Running a race

**Terminal:** `/attacking-the-pin --n 3 <task>` (also `/fanout`). **Agent:** the steps below, with `loop.fanout.count` candidates (default 3).

1. **Frame the task.** One clear statement of what each candidate must produce. All candidates get the same task; only the angle differs.
2. **Angles.** Each candidate gets a different brief — smallest sufficient change, failure first, codebase-native, test first, rebuild around the requirement, data shape first. Different angles produce different shapes; the same prompt N times mostly produces the same answer.
3. **Models.** Spread candidates across the available models that are capable of the task's difficulty, strongest first (see *Who does the work*).
4. **Isolation.** Create one worktree per candidate inside the git-ignored `.mulligan/sessions/race/`: `git worktree add --detach .mulligan/sessions/race/<letter> <base>`, where `<base>` is `HEAD`, or the commit `git stash create` prints when the developer has uncommitted work. Node finds the main checkout's `node_modules` by walking up; link other ignored dependencies instead of installing them. Each brief gives the task, the angle, the worktree path (work only there), the verification commands, and two rules: do not commit, do not open `.mulligan/verification/`. The developer's working tree is never touched while candidates run. A candidate whose diff does not apply is out. A single delegate (**mulligan-mode**, step 5) gets a worktree the same way.
5. **Verification.** The project's verification commands run in each worktree. Pre-approved commands run unattended; others ask first. A candidate that fails ranks below every candidate that did not.
6. **Blind judging.** Collect each candidate's diff (`git -C <worktree> add -A && git -C <worktree> diff --cached <base>`) and its verification output. Judges (`mulligan-reviewer`, read-only) see the rubric, the task, the candidates as letters and the evidence — never which model wrote which. Run each judge on a different model family from yours where the host offers one, and never on a candidate's model when another is available. Start judges only after every candidate has finished.
7. **Your own read.** While the judges work, read every candidate end to end and score it against the rubric criterion by criterion. Agreement with the judges confirms the ranking; disagreement means the rubric was ambiguous or one of you is biased — read the candidates' rationales again before deciding, and say which way you went.
8. **Scoring.** The private rubric (`.mulligan/verification/rubric.yaml`) weights Correctness and the four Karpathy principles plus project standards. The judges' mean is adjusted by hard evidence: verification results, size relative to the smallest candidate, files no other candidate needed, tests, stated success criteria and assumptions, and cookbook violations in new lines. Implementing models never see the rubric.
9. **Ranking.** Candidates are ranked with every adjustment shown. Large judge disagreement and near-ties are flagged for the developer to read themselves.

## After the race

- **Apply the leader, keep the rest.** Apply the top-ranked candidate's diff to the working tree (`git apply`), uncommitted, then remove the race worktrees (`git worktree remove --force`) before running verification in the main checkout — test runners there would otherwise pick up the candidates' files. Save every candidate's diff to `.mulligan/sessions/race/<letter>.patch` first so the developer can swap.
- **The developer chooses.** The applied candidate is a proposal like any other implementation. `/pick <letter>` or "use candidate B" swaps it for another saved diff. The ranking informs the decision; it does not make it.
- **Grafting.** If a losing candidate has one clearly better idea (a test, an edge case, a cleaner type), port it into the chosen one by hand and verify again. Keep the result coherent; do not paste pieces together.
- **Signals.** When candidates converge on one shape, that is strong agreement — note it. When they diverge wildly, the task was under-specified: reframe it rather than averaging.
- **Learning.** What the developer chose — and what they rejected — becomes Mulligan Memory candidates through `/accept` and `/take-a-mulligan`.

## Report

The ranking table, each candidate's approach and evidence, the recommendation and why, the notes (ties, disagreement, gates), and where the candidates and diffs are saved.
