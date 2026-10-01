---
name: mulliganMem-review
description: Compare what Mulligan has learned (.MulliganMem) against what the codebase, git history, PR history, cookbook and verification results actually show; identify the developer's strengths and knowledge gaps with evidence; produce a personalised multi-step upskilling plan. Educational, not a grading system.
---

# MulliganMem Review

The goal is a learning loop, not a report card:

```text
AI teaches developer → developer applies knowledge → developer corrects AI
→ AI learns preference → developer improves → AI becomes better aligned
```

## Non-negotiables

- **No grades or scores.** Strengths and gaps, each with evidence.
- **Every gap cites what caused it** — `file:line`, a commit, a review comment, a cookbook
  violation. No evidence, no gap.
- **Distinguish two kinds of gap:**
  - *Stated but not applied* — the principle is in `.MulliganMem` or the cookbook, but the
    code does not follow it yet. Lead with these: the developer already knows them.
  - *Not yet in memory* — a knowledge gap the developer may not be aware of.
- **Do not add anything to `.MulliganMem`.** Suggest principles; the developer decides.
- **Be honest about coverage**: say what the scanners cannot see (design quality, product fit).

## Workflow

1. Run the evidence engine:

   ```bash
   Mulligan mem-review
   ```

   It scans the codebase and git history for signals (type safety, runtime validation,
   error boundaries, accessibility testing, regression testing, error handling, change size,
   React list keys), evaluates the cookbook across the codebase, and compares both with
   `.MulliganMem`.

2. Enrich with sources the engine cannot read on its own when available: merged PR review
   comments (`.mulligan/golden-pr/examples/*.json`), recent `/mulligan-review` reports in
   `.mulligan/audit/reviews/`, and verification results.

3. For each gap, write an **upskilling plan** that the developer can complete in steps:

   ```text
   Gap N — <topic>

   Why identified:
   <the evidence, in one or two sentences>

   Step 1  Learn the concept (what and why)
   Step 2  Review patterns (in this codebase where possible)
   Step 3  Apply it to one real place — name the file
   Step 4  Write the tests that prove it
   Step 5  Review the result with Mulligan (/mulligan-review)
   Step 6  Add the resulting principle to Mulligan Memory if you accept it
   ```

   Keep steps small and concrete. Use the developer's own code as the exercise.

4. List **consistent practice not yet in memory** and offer each as a principle
   (`/memory add <category>: <rule>`). List pending candidates (`/memory review`).

## Output

```text
MULLIGANMEM REVIEW

KNOWN STRENGTHS
  ✓ <practice> — <evidence>

POTENTIAL GAPS
  1. <topic> — <summary>  (stated but not applied | not yet in memory)
     · <evidence>

UPSKILLING PLAN
  …

CONSISTENT PRACTICE NOT YET IN MEMORY
  • …
```
