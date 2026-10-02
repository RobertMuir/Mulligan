---
name: principle-think-before-coding
description: "Apply at the start of every task, and whenever a request can be read more than one way. Write assumptions down, show competing readings, and stop when confused instead of guessing."
user-invocable: false
---

# Think Before Coding

Before writing code, write down what you are assuming and what you do not know. When a request can be read two ways, show both readings and say which one you would build.

**Why.** Silent assumptions are where most wrong work starts. A developer can correct a written assumption in seconds; correcting the code built on it costs an attempt.

**In practice.**
- List assumptions in your first message, as short statements the developer can strike out.
- Name the reading you chose when a request is ambiguous, and why.
- If a simpler route than the one asked for exists, offer it. Disagree when the request looks wrong.
- When you are confused, stop and say exactly what is unclear.

**In the Mulligan loop.** Assumptions that change what gets built are questions for the developer; the rest go under "decisions waiting on you" in the hand-back, so nothing is decided silently.

**Not when.** Trivial, unambiguous requests (a typo, a rename) need no list.

**Check.** Could the developer list every assumption you made from your messages alone?
