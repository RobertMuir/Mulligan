---
name: principle-simplicity-first
description: "Apply when sizing a change, choosing a design, or tempted to add an option, layer, helper or abstraction. Write the least code that fully solves the stated problem."
user-invocable: false
---

# Simplicity First

Write the least code that fully solves the stated problem: no speculative features, no abstraction with one user, no options nobody asked for, no handling for cases that cannot happen.

**Why.** Every extra line is something the developer must review and someone must maintain. Over-built code is the commonest way AI work loses a reviewer's trust.

**In practice.**
- Start from the smallest change that meets every success check.
- Inline a helper with one caller; delete an option with one value.
- If the change is three times longer than it needs to be, rewrite it shorter before handing it back.
- Simplicity governs the size of a change, not whether to verify it.

**In the Mulligan loop.** When a bigger design is genuinely justified, say why in the hand-back so the developer can weigh it rather than discover it.

**Not when.** Required behaviour is never "simplified" away: correctness and security come first.

**Check.** Would an experienced engineer on this team call the change over-built?
