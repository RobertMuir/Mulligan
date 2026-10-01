---
name: divot-analysis
description: Design a rigorous, auditable plan for work no ready-made playbook fits — big migrations, sprawling changes across many parts, or work the developer will only inspect afterwards — then run it as a series of verified experiments with a decision log. Use for /divot-analysis, large or unfamiliar work.
---

# Divot analysis

*In golf terms for designing and running a rigorous plan for large or unfamiliar work.*

When no playbook fits, the first deliverable is the plan itself: how the work will be split, checked and recorded so the developer can trust the result without having watched it happen.

## 1. Frame — and agree it

Before any code, write down:

- **Done**, as a check that could fail: "every caller of `legacyStore` uses `asyncStore`, the old module is deleted, and the full test suite passes".
- **Scope**, in numbers: how many files, callers, services or steps, and what you found that could block you.
- **Rigour**, and why. Irreversible steps and wide impact get more checks; reversible, low-stakes steps get fewer. Rigour means gates and evidence, not effort.

Show the framing to the developer and agree it before a long run — it is their decision how much risk the work carries.

## 2. Design the work

- Split it into small units that can each land and be checked on their own. Do the riskiest unknown first.
- Build the check before the work, and record the baseline from the current state, so every result reads "before → after".
- For one-way design decisions, run **architect**. Skip it where the shape is already settled.
- Parallelise only along real seams, each worker on its own branch or worktree. Do not over-split.
- Prefer a script or codemod to many hand edits (Build the tool) — it can be re-run and reviewed.

Write the unit list down. It is what the developer reviews.

## 3. Run each unit as an experiment

Say what you expect to happen, change as little as possible, compare the real result with the definition of done, then keep or undo the change depending on whether it moved you forward. Do not start the next unit on a red check.

- Check artifacts, not self-reports. If something passes suspiciously easily, suspect the check.
- Pair delegated work with an independent check. If a worker games the check, reset and tighten it; if the check itself is wrong, fix it as its own change.
- Every unit ends **PROVEN**, **FAILED** or **UNPROVEN**. Unproven never counts as proven, and failures are reported, not buried.

## 4. Keep a decision log

Append one row per decision to `.mulligan/sessions/<session>/decisions.tsv`:

```
time	unit	decision	why	evidence	verdict
```

For large work, offer to commit the log with the change so reviewers can follow it.

## 5. Verify the whole and hand back

Check the result against the definition of done on the real product, not only the harness. Run **mulligan-review**. Turn any repeated correction into a check (**reflect**).

**Reply:** the plan you designed, the rigour chosen and why, where the decision log is, what is verified against the definition of done, and what is still open for the developer.
