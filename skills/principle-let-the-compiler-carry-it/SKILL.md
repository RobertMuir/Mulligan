---
name: principle-let-the-compiler-carry-it
description: "Apply when designing types or signatures, or tempted to cast, assert or suppress a type error. Make invalid states impossible to build and let the compiler enforce them."
user-invocable: false
---

# Let the Compiler Carry It

Make invalid states impossible to construct. Give look-alike values their own types, derive types from the schema that owns them, and make matches exhaustive so a new case breaks the build where it must be handled.

**Why.** A type the compiler checks is a test that runs on every keystroke. A cast is a promise nobody checks.

**In practice.**
- Never cast past the type checker; prove the fact or treat the cast as a known risk and say so.
- Tighten a type only where its looseness forces a lie: a `!`, a cast, a "can't happen" branch.
- No `any`, no `@ts-ignore`; `unknown` plus a parse instead.

**In the Mulligan loop.** A deliberate exception is marked with its reason so review can see it.

**Not when.** Do not build type machinery the operations do not need.

**Check.** Could a new variant or a malformed value get past the compiler unnoticed?
