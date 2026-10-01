---
name: principle-try-two-real-shapes
description: "Apply to a decision with no precedent in the codebase, or one reasonable engineers would make differently. Build two or three genuinely different candidates and compare them before committing."
user-invocable: false
---

# Try Two Real Shapes

For a design decision without precedent, build two or three genuinely different candidates and compare them on evidence before committing. Variations of one idea do not count.

**Why.** The first shape is rarely the best one, and comparing real candidates is cheaper than discovering the better shape after review.

**In practice.**
- Use **architect** for designs and **attacking-the-pin** for competing implementations.
- Different angles (smallest change, failure first, data shape first) produce different shapes; the same prompt three times does not.
- When candidates converge, that is strong agreement: say so and ship the shared shape.

**In the Mulligan loop.** The comparison goes to the developer as a table with a recommendation; they choose.

**Not when.** Mechanical work, bug fixes with a known cause, and changes that follow an established pattern have one obvious shape. Do not race them.

**Check.** Were the candidates different in kind, not just in detail?
