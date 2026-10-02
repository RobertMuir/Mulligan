---
name: principle-hand-back-with-evidence
description: "Apply when writing any reply that reports work. Lead with the impact, label every claim, and always include what was not verified and what is waiting on the developer."
user-invocable: false
---

# Hand Back With Evidence

The hand-back is where the developer decides, so it has to be quick to act on and impossible to misread. Lead with what changed for the people affected, then how, then the proof.

**Why.** A confident summary that hides a guess is worse than no summary. Labelled claims let the developer spend their review where the uncertainty is.

**In practice.**
- Label each claim measured (you ran it), read (you saw it in code or docs) or inferred.
- Quote the decisive output: counts, the failing line before, the passing line after.
- Always include "not verified" and "decisions waiting on you", even when short.
- Give a way out: how to undo the change.

**In the Mulligan loop.** This is the developer's decision point: accept, modify, or take a Mulligan.

**Not when.** A one-line answer to a one-line question needs no structure.

**Check.** Could the developer accept or reject this without re-running anything?
