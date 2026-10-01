---
name: digging-it-out-of-the-dirt
description: Work out what a change could break outside its own diff, find the single fact its safety rests on, and prove that fact by running real code. Use for "what could this break", "blast radius of X", or a small diff you do not fully trust.
---

# Digging It Out of the Dirt

*In golf terms for blast radius: what this change could break beyond its own diff.*

Listing callers is the easy part — a search does that. The job is the breakage a search does not show, and proof that it will not happen.

Mulligan Review's BLAST RADIUS and SURGICAL CHANGES sections give you the starting facts (files outside the main area, config and dependency changes, migrations). This skill goes deeper.

## Do not trust a convincing write-up

A risk analysis reads equally well whether or not it is true. What matters is the evidence behind each claim. For every fact the change's safety depends on, push it as far down this ladder as is cheap, and report where it stopped:

1. **Claimed** — you said so. Worth nothing alone.
2. **Cited** — you name the exact `file:line`, or the line in the dependency's source.
3. **Reasoned** — you walked the failing case step by step and showed it cannot be reached.
4. **Executed** — a script or test calls the real code and would fail loudly if you were wrong.
5. **Reproduced** — you exercised it in the running application.

## Steps

1. **Read the change completely:** the diff, every symbol it adds, changes or removes, and the behaviour it changes without spelling out. Use **reading-the-flight** to read the PR and commit messages.
2. **Find the load-bearing fact.** Most risky-looking changes are safe because of one fact ("this only evicts entries that are already expired"). Find it. If it holds, most of the risks fall away at once. Most of the effort belongs here, not in an inventory of what-ifs.
3. **Look where search does not reach:**
   - the source of the libraries involved, at the pinned version, including local patches;
   - timing — teardown order, async boundaries, retries, what runs during shutdown;
   - data that crosses boundaries — API responses, database columns, file formats, another service or language reading the same bytes;
   - feature flags and configuration that change which path runs;
   - effects several calls downstream.
4. **Weigh each risk honestly:** how likely, how bad, and how you would check. Keep the confirmed risks, and a separate list of the ones you ruled out. Never invent a caller or an API; an empty search is a result.
5. **Prove the load-bearing fact** with a small script or test that imports the real code and fails if you are wrong. Run it and keep the output.
6. **For a wide change,** ask several models the same question (**interrogate**) — different models find different real problems.

## Report

- **What the change does,** including the part that is not obvious.
- **The load-bearing fact,** how far up the ladder you got, and the proof — or "unproven".
- **Risks** — each with how it breaks, `file:line`, likelihood, impact and how to check.
- **Checked and cleared** — and why each is fine.
- **Before merging** — the cheapest test or reproduction that would catch the real problem, including the script you wrote.
