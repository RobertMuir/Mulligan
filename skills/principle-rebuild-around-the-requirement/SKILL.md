---
name: principle-rebuild-around-the-requirement
description: "Apply when a new requirement lands on an existing design, or during a planned migration. Move towards the shape the code would have had if the requirement had been known from day one."
user-invocable: false
---

# Rebuild Around the Requirement

When a requirement arrives, ask what the code would look like had it been known from the start, and move towards that rather than bolting it on. In a migration, converge on the target shape instead of polishing every intermediate state.

**Why.** Bolted-on requirements leave special cases that every later change must step around.

**In practice.**
- Carry the change through types, docs and examples.
- Deliver it in verified steps; say where temporary breakage is acceptable.
- Keep it proportionate: reshape what the requirement touches, not the whole module.

**In the Mulligan loop.** A reshaping bigger than the request is proposed to the developer before it is built.

**Not when.** A one-line fix does not need a redesign.

**Check.** Would someone reading this later be able to tell which requirement came last?
