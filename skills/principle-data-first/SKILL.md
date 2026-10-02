---
name: principle-data-first
description: "Apply before writing logic, and when code keeps branching on the same facts. Choose the data structure first and let the logic follow; encode the domain in a structure rather than scattered conditionals."
user-invocable: false
---

# Data First

Choose the data shape before the logic. Trace how the data is read and written and pick the shape that makes the common paths short. When code keeps branching on the same facts, put those facts in a structure: a state machine, a discriminated union, a lookup table.

**Why.** Logic written against the wrong shape fights it forever. The right shape makes most branches disappear.

**In practice.**
- Name the data shape in your plan before writing code.
- A new feature that adds one more branch to a chain, or a second flag that must stay in step with the first, is the signal to restructure.
- Put shared foundations (types, tests, checks) in place before the features that rely on them.

**In the Mulligan loop.** When the shape is a real choice, it goes in the plan the developer sees.

**Not when.** Code that is already clear and local does not need a structure forced onto it.

**Check.** Is there one place that says what states this data can be in?
