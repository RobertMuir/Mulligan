---
name: principle-one-verified-step-at-a-time
description: "Apply to multi-step work: migrations, sweeps, runs of similar edits, stacked changes. Break it into small steps that each end in a passing check."
user-invocable: false
---

# One Verified Step at a Time

Break work into small steps that each end in a check, and do not start the next step on a red one. Order the work so the sequence argues for itself: the failing test, then the fix.

**Why.** A failure caught one step after it was introduced is cheap; one found at the end could be anywhere.

**In practice.**
- Write each step's check before the step.
- Keep the suite green between steps.
- Stop and report when a step cannot be made green, instead of piling on.

**In the Mulligan loop.** Long work keeps a short log of steps and results the developer can read later.

**Not when.** A single small edit is one step.

**Check.** Did every step end on green before the next began?
