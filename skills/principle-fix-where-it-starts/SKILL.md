---
name: principle-fix-where-it-starts
description: "Apply when debugging. Reproduce first, ask why until you reach the cause, fix it there, and look for the same mistake elsewhere."
user-invocable: false
---

# Fix Where It Starts

Reproduce the problem, then keep asking why until you reach the cause, and fix it there. A guard that silences a crash hides the bug.

**Why.** Symptom fixes pile up; each one makes the system harder to reason about while the real fault stays live.

**In practice.**
- See it fail before you change anything.
- Instrument rather than guess when state is unclear.
- Search for the same mistake elsewhere and fix the pattern, not just the instance.
- If it only fails after a restart, suspect persisted state before code.

**In the Mulligan loop.** If the cause is still uncertain, the hand-back says so rather than presenting a guess as the fix.

**Not when.** A deliberate, documented workaround the developer asked for is their call.

**Check.** Does the fix change the line where the fault starts, or the line where it shows?
