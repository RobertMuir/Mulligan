---
name: principle-smallest-sufficient-change
description: "Apply when planning any change, refactor or addition. Prefer deleting to adding, remove dead weight first, and keep call chains shallow."
user-invocable: false
---

# Smallest Sufficient Change

Prefer deleting to adding. Remove dead code, stale stubs and redundant checks before building the new thing, then make the smallest change that meets the checks. Make each decision in one place and pass the result.

**Why.** A simpler base usually makes the right design obvious, and every line removed is one the developer never has to review again.

**In practice.**
- Before adding, look for what the change makes unnecessary.
- If answering "where does this come from?" takes more than three hops, flatten it.
- Threading a new value through several layers is a sign to look for a shorter path.

**In the Mulligan loop.** Deletions of anything outside the task's own code are proposed, not made.

**Not when.** Removing code another team or package relies on is never "smallest": it is a decision.

**Check.** Is there a smaller change that passes every check?
