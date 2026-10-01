---
name: architect
description: Design before implementing — write the caller's usage, choose the data shapes, sketch types and module boundaries, compare at least two genuinely different designs, and agree the shape with the developer before filling in code. Use for /architect, "design this", or any change that crosses a function or module boundary.
---

# Architect

Getting the shape wrong is the most expensive mistake, and it is cheapest to fix before the code exists. Sketch first; fill in later; throw the sketch away if implementation proves it wrong.

## 1. Understand what the design must fit

Run **how** over every part of the system the new code touches. If the design changes who owns what, also run **reading-the-flight** on the current shape, so past reasons become constraints rather than surprises. Read Mulligan Memory and the cookbook's architecture rules. Skip this only for genuinely new code with nothing around it.

## 2. Write the usage first

Before any types, write what a caller will do: a short README-style example and a few call sites from real-looking code. The design exists to serve this usage. If the types and the usage disagree later, change the types.

## 3. Sketch at least two different designs

A real alternative changes the overall shape, not a detail inside the same shape. For each design:

- the core data types and how they are read and written;
- the public functions and their signatures;
- the module map;
- bodies left as `throw new Error('not implemented')` with comments for the tricky logic.

To get genuinely different candidates, fan out (**attacking-the-pin**) with the design task and [references/design-brief.md](references/design-brief.md) — different models and angles produce different shapes.

## 4. Check each design

Check each candidate with [references/design-checks.md](references/design-checks.md). Prefer the design that hides the most behind the smallest public interface. Note which Mulligan principles each design honours or strains.

## 5. Agree the shape with the developer

Present the chosen design using [references/rationale.md](references/rationale.md): usage, shape, trade-offs, alternatives, open questions. **Wait for the developer's agreement before implementing** — this is a one-way door and their decision. If they push back, treat it as new information: go back to step 1 or 3.

## 6. Implement against the sketch

Fill in the bodies. The sketch is the contract. When the implementation wants something the sketch did not anticipate (an extra parameter, a cast, a lock), stop and ask whether the sketch, the requirement or the implementation is wrong. Report deviations; do not absorb them silently.

## 7. Scrap it when it is wrong

One awkward case does not condemn a design. A pattern does:

- the same workaround appearing in unrelated places;
- several edge cases each needing a special branch;
- types that only compile with `any`, casts, or optional fields that are always set;
- needing a lock for state the sketch said was not shared;
- callers having to know the module's internals to use it.

When you see the pattern: re-run **how** on what exists, design again assuming today's constraints had been there on day one, make the new sketch smaller than the old one, and return to step 3.
