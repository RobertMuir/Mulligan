---
name: tdd
description: Make a bug executable before fixing it — a focused check that fails for the right reason, then the smallest fix that makes it pass. Use when the developer wants test-first work, or when the defect lives in code that is quick to test. Skip when the only test path is slow, brittle or unclear.
---

# Test first, then fix

The aim is a single targeted check: red while the bug is present, green once it is fixed — proof the bug existed and is gone.

## Steps

1. **Pin down the bug:** what should happen, what happens instead, which code path, and the smallest input that shows it.
2. **Pick the narrowest check** that already exists for that path — a unit, component or integration test in the project's own style. Do not build a new test harness just to follow this skill.
3. **Write the check first.** It encodes the intended behaviour, not the current implementation.
4. **Run it before fixing.** It must fail, and for the reason you expect. If it passes, or fails for something else, fix the check or your understanding before touching the code.
5. **Make the smallest fix** that satisfies the intended behaviour without breaking nearby contracts.
6. **Run it again.** It passes. Run the neighbouring tests too.

## When a test does not fit

If the only option would need a big harness, lots of mocks, a slow full-stack environment, data that exists only in production, or a reproduction nobody can pin down, use the nearest executable check instead: a targeted script, a reproduction command, a log assertion, a browser automation run.

No test is better than a bad test. A bad test checks mocks rather than behaviour, mirrors the implementation, depends on timing or shared state, or would be deleted right after proving the fix. Apply "Tests that can fail" from the Mulligan principles: if the test would still pass with every import returning `undefined`, it is not a test.

## Rules

- Never change a test to match a wrong implementation.
- Never weaken an existing assertion unless the intended behaviour genuinely changed, and say why.
- Keep the test about this bug. Wider coverage is a separate task.
- For a flaky bug, make the check deterministic where you can, and say what signal it locks down.

## Report

The failing check and its failure output (before), the passing run (after), and anything else you ran. If you could not show a failure first, say why and what you used instead.
