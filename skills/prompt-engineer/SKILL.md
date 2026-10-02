---
name: prompt-engineer
description: Turn a loose request into a precise brief an implementing model can execute well — the goal, the context, the constraints from the cookbook and Mulligan Memory, explicit success checks and what is out of scope — using the template for the kind of work (feature, bug, refactor, architecture, test, security). Use before delegating work to another model or a fan-out, or for "write a prompt for this".
---

# Prompt engineer

A model can only be as precise as its brief. Most bad attempts start with a brief that left the goal, the constraints or the definition of done unstated. This skill writes the brief.

## 1. Pick the template

| Work | Template |
|---|---|
| New or changed behaviour | [feature/TEMPLATE.md](feature/TEMPLATE.md) |
| A defect | [bug/TEMPLATE.md](bug/TEMPLATE.md) |
| Structure changes, behaviour does not | [refactor/TEMPLATE.md](refactor/TEMPLATE.md) |
| A design decision | [architecture/TEMPLATE.md](architecture/TEMPLATE.md) |
| Tests for existing code | [test/TEMPLATE.md](test/TEMPLATE.md) |
| A security fix or review | [security/TEMPLATE.md](security/TEMPLATE.md) |

## 2. Fill it from evidence, not imagination

- **Goal** — in the developer's words where possible.
- **Context** — the real files and symbols involved (use **how**), and anything **reading-the-flight** found that constrains the change.
- **Constraints** — the cookbook rules and Mulligan Memory principles that apply, including any `ai_must_ask` areas the model must not touch. Note memory as preference, so the model can flag a justified exception.
- **Success checks** — concrete and runnable: tests, commands, observable behaviour (Goal-Driven Execution).
- **Out of scope** — what not to change (Surgical Changes).
- **Assumptions to state** — the open questions the model must answer explicitly rather than guess (Think Before Coding).

When the source is a pasted ticket or a loose request, keep the developer's own words for the goal, mark every part you inferred (`[inferred]`), turn vague acceptance ("should work properly") into runnable checks, and put open questions at the top, each with a proposed answer.

## 3. Check the brief before sending it

- Could two competent engineers read it and build different things? Then it is ambiguous — tighten it or list the readings.
- Is every success check something a machine or a person can actually run?
- Does it ask for more than the task needs? Remove it (Simplicity First).
- Does it leak the private rubric? It must not — implementing models never see the scoring.

## 4. Agree it with the developer

Show the brief and ask the developer to confirm or edit it before any code is written (**principle-brief-before-build**). Their edits are the most useful signal you will get about what they meant. If they are unavailable, proceed on the brief and list its `[inferred]` parts under the decisions waiting on them.

## 5. Use it

Pass the agreed brief to the build step of **mulligan-mode**, to a race (**attacking-the-pin**), or to a subagent. Keep it with the session so a Mulligan can reuse and sharpen it.
