---
name: take-a-mulligan
description: The developer has rejected an approach. Record why, turn the reason into a candidate lesson, and come back with a fundamentally different approach — fanning out to several models and escalating model strength when the task warrants it. Use for /take-a-mulligan, "take a Mulligan", "try a different approach", "no, not like that".
---

# Take a Mulligan

A Mulligan is not a retry. The developer has told you the *approach* is wrong. Doing the same thing again with small changes ignores them. The next attempt must start from what was learned.

## 1. Get the reason

Ask why the approach is wrong, unless they already said. The reason is the most valuable thing in the exchange — it is what makes the next attempt different and what Mulligan learns from. If they cannot articulate it, offer two or three readings of what might be wrong and let them choose.

## 2. Learn — as a candidate

Turn the reason into a proposed lesson (CLI: automatic; agent: `memory_propose` with `source: human_rejected`; without the tool, write it under **Memory candidate** in your reply and leave `.MulliganMem` alone). Keep the developer's own words when they gave them. A single rejection is evidence, not a law, so the lesson is a **candidate** until the developer confirms it. Never confirm it for them.

## 3. List what has been rejected

Every approach rejected on this task so far, each with its reason. The next attempt must not be a variation of any of them.

## 4. Re-think before re-coding

- What assumption did the rejected approach make that the reason contradicts? Change that assumption, not the surface.
- Is there a recorded Mulligan Memory principle or cookbook rule the rejected approach ignored?
- Was the task misunderstood? If so, restate it and confirm with the developer before building.

## 5. Try again — differently

- **Escalate.** Each Mulligan adds 10 to the task's difficulty (**mulligan-mode**, *Models*), so stronger models are used as attempts fail.
- **Race it.** A rejected approach means the shape is contested, so send the task to several models from different angles with the rejected approaches listed as off limits (**attacking-the-pin**). Under `loop.fanout.auto: false`, give one delegate a brief built around what was rejected instead.
- **Say how it differs.** Open the new attempt with one paragraph: how it differs from what was rejected, and why that addresses the developer's reason.

## 6. Verify and hand back

Verify the new attempt like any other (**mulligan-review**), then let the developer decide again. If two Mulligan in a row fail on the same underlying assumption, stop and question the assumption itself with the developer before a third attempt.

The question this skill must always be able to answer: *what did we learn from the last attempt, and how did it change this one?*
