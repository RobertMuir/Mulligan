---
name: principle-readable-in-thirty-seconds
description: "Apply when shaping or reviewing code that is hard to follow. Minimise what a reader must trace and hold in their head."
user-invocable: false
---

# Readable in Thirty Seconds

Maintainability is how much a reader has to trace and remember. Remove wrappers with one caller and layers that only forward, prefer local and immutable state, and state each invariant once, where it is enforced.

**Why.** The developer has to understand the change to own it. Code they cannot follow is code they cannot safely accept.

**In practice.**
- Collapse one-caller wrappers and pass-through layers.
- Shrink the scope of mutable state.
- Name things for what they mean in the domain.

**In the Mulligan loop.** Readability is judged from the developer's seat: if you needed a paragraph to explain it, simplify the code, not the paragraph.

**Not when.** Do not restructure working code the task does not touch.

**Check.** Could someone new find where a value is set, and everything that changes it, within thirty seconds?
