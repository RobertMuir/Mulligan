---
name: principle-tests-that-can-fail
description: "Apply when writing, changing or keeping a test. Drive real entry points, assert fixed expected values, and make sure the test fails against the code it is meant to catch."
user-invocable: false
---

# Tests That Can Fail

A test earns its place only if it would fail when the code is wrong. Drive the entry points real callers use and assert against hard-coded expected values.

**Why.** Tests that cannot fail give the developer false confidence, which is worse than no tests.

**In practice.**
- Run a new test against the old code first: it must fail for the right reason.
- Imagine every imported function replaced by a stub returning undefined; if the test still passes, strengthen it.
- Watch for: asserting only "defined" or "truthy", only checking a mock was called, comparing code with itself, asserting on your own fixture.
- Never delete, skip or loosen an existing test to make a change pass without saying why.

**In the Mulligan loop.** The hand-back says which tests failed before the change and pass after.

**Not when.** Characterisation tests for a refactor are meant to pass before and after; their job is to catch a change.

**Check.** Would this test fail if the behaviour it names broke?
