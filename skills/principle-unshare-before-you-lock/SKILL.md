---
name: principle-unshare-before-you-lock
description: "Apply when two actors — threads, jobs, agents, processes — could write the same file, key, branch or record. Remove the sharing before adding a lock."
user-invocable: false
---

# Unshare Before You Lock

When two actors could write the same thing, first ask whether they need to. Usually each can own its own and the results can be merged when read. Serialize with a real mechanism only when one shared target is genuinely required.

**Why.** Locks are where concurrency bugs live. Giving each actor its own target removes the race instead of managing it.

**In practice.**
- Give each parallel worker its own worktree, file or key.
- Merge results on read rather than coordinating writes.
- A convention ("only touch your part") is not concurrency control.

**In the Mulligan loop.** When a shared target remains, the hand-back names the mechanism that protects it.

**Not when.** Single-writer code needs no ceremony.

**Check.** Could two writers ever touch this at once — and what stops them?
