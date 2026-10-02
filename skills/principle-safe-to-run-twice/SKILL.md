---
name: principle-safe-to-run-twice
description: "Apply when writing anything that changes state: commands, migrations, jobs, sync, retries. It must reach the same end state if it runs twice or restarts after a crash."
user-invocable: false
---

# Safe to Run Twice

Anything that changes state should converge on the same result if it runs twice, or restarts halfway through.

**Why.** Retries, crashes and double clicks are normal. Code that assumes it runs exactly once corrupts data the first time that assumption fails.

**In practice.**
- Ask both questions before shipping: what if this runs twice? what if it stops halfway?
- Prefer upserts, idempotency keys and "ensure" operations over blind inserts and toggles.
- Make partial progress resumable rather than restarting from scratch.

**In the Mulligan loop.** Where idempotency is impossible, say so in the hand-back and name the guard instead.

**Not when.** Pure reads need nothing.

**Check.** What happens if this runs twice?
