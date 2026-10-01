---
name: principle-brief-before-build
description: "Apply when a request arrives as a long paste (a ticket, an issue thread, a chat log) or lacks a clear goal, scope or definition of done. Turn it into a brief and agree it with the developer before building."
user-invocable: false
---

# Brief Before Build

A model can only be as precise as its brief. When the request is loose, write the brief it should have been — goal, context, constraints, success checks, out of scope, open questions — with the **prompt-engineer** skill, show it to the developer, and build only once they agree.

**Why.** Most failed attempts trace back to an unstated goal or definition of done. A two-minute review of a brief is the cheapest point at which to catch a misunderstanding.

**In practice.**
- Keep the developer's own words for the goal; add what is missing rather than rewriting what is there.
- Mark every addition you inferred, so the developer can see what they did not say.
- Turn vague acceptance ("should work properly") into runnable checks.
- Put open questions at the top of the brief, each with your proposed answer.

**In the Mulligan loop.** Show the brief and wait for agreement or edits. If the developer is unavailable, proceed on the brief and list its inferred parts under the decisions waiting on them.

**Not when.** A short, clear request needs no brief — restating it is enough.

**Check.** Could two competent engineers read the brief and build the same thing?
