---
name: attacking-the-pin
description: Fan a task out to several models at once — each attacking it from a different angle — apply and verify every candidate in its own isolated worktree, have blind judges score each one against the private rubric, and rank them with evidence for the developer to choose. Also splits large checks across parallel workers. Use for /attacking-the-pin, /fanout, "try several approaches", "compare models", or any hard task.
---

# Attacking the pin

*In golf terms for fanning a problem out to several models and ranking the results.*

One attempt at a hard problem locks in whatever shape came first. A swarm gets several genuinely different attempts, checks each against reality, and lets evidence and a rubric — not the loudest answer — decide the ranking. The developer picks.

Mulligan does this automatically in the loop: `/implement` and `/take-a-mulligan` fan out when a task's difficulty crosses the threshold in `.mulligan/config.yaml` (`loop.fanout`).

## Two shapes

- **Race** — several candidates for the *same* task, ranked. This is the default and what the rest of this skill describes.
- **Split** — one large job divided into slices (one package, one feature, one file set per worker), each worker reporting PASS, ISSUES or BLOCKED with evidence, combined into one report. Use it for audits and wide checks. A slice with no result is a gap, not a pass.

## Running a race

**Terminal:** `/attacking-the-pin --n 3 <task>` (also `/fanout`). **Agent:** the `mulligan_fanout` tool.

1. **Frame the task.** One clear statement of what each candidate must produce. All candidates get the same task; only the angle differs.
2. **Angles.** Each candidate gets a different brief — smallest sufficient change, failure first, codebase-native, test first, rebuild around the requirement, data shape first. Different angles produce different shapes; the same prompt N times mostly produces the same answer.
3. **Models.** Mulligan spreads candidates across the configured models that are capable of the task's difficulty, strongest first. Local models (Ollama, llama.cpp, LM Studio, vLLM) take part like any other.
4. **Isolation.** Each candidate is applied in its own temporary git worktree that carries the developer's uncommitted work. The developer's working tree is never touched. A candidate that does not apply is out.
5. **Verification.** The project's verification commands run in each worktree. Pre-approved commands run unattended; others ask first. A candidate that fails ranks below every candidate that did not.
6. **Blind judging.** Judges see the rubric, the task, the candidate and the evidence — never which model wrote it — and never judge their own model's work when another model is available.
7. **Scoring.** The private rubric (`.mulligan/verification/rubric.yaml`) weights Correctness and the four Karpathy principles plus project standards. The judges' mean is adjusted by hard evidence: verification results, size relative to the smallest candidate, files no other candidate needed, tests, stated success criteria and assumptions, and cookbook violations in new lines. Implementing models never see the rubric.
8. **Ranking.** Candidates are ranked with every adjustment shown. Large judge disagreement and near-ties are flagged for the developer to read themselves.

## After the race

- **The developer chooses.** `/pick <letter>` makes a candidate the current attempt; `/apply` applies its git-generated diff after approval. The ranking informs the decision; it does not make it.
- **Grafting.** If a losing candidate has one clearly better idea (a test, an edge case, a cleaner type), port it into the chosen one by hand and verify again. Keep the result coherent; do not paste pieces together.
- **Signals.** When candidates converge on one shape, that is strong agreement — note it. When they diverge wildly, the task was under-specified: reframe it rather than averaging.
- **Learning.** What the developer chose — and what they rejected — becomes Mulligan Memory candidates through `/accept` and `/take-a-mulligan`.

## Report

The ranking table, each candidate's approach and evidence, the recommendation and why, the notes (ties, disagreement, gates), and where the candidates and diffs are saved.
