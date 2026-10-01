---
name: principle-goal-driven-execution
description: "Apply before starting any change and at every step of multi-step work. Turn the request into checks that prove it is done, then prove each one."
user-invocable: false
---

# Goal-Driven Execution

Turn the request into checks before you start: "add validation" becomes "these invalid inputs are rejected, proven by these tests"; "fix the bug" becomes "this reproduction fails now and passes after".

**Why.** Clear checks let you work without asking and let the developer accept without re-testing. Vague goals force guesses and second attempts.

**In practice.**
- Write the behaviour that must change, the behaviour that must keep working, and the command that proves each.
- Give every step of multi-step work its own check.
- Stop when the checks pass and the review is clean.

**In the Mulligan loop.** The checks open the hand-back's proof section, each with its result.

**Not when.** Exploratory prototypes prove a decision, not a feature; their check is the question they answer.

**Check.** What, exactly, proves this is done?
