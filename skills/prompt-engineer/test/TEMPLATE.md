# Test brief

**Code under test.** {module, functions} — how users call it: {…}

**Behaviours to prove.**
1. {input} → {literal expected output or effect}
2. {edge case: empty, boundary, invalid input} → {expected}
3. {failure path} → {expected error or recovery}

**Rules.**
- Exercise the code through the entry points real callers use; check results against hard-coded expected values.
- Mock only what cannot run locally; assert what a mock received, not just that it was called.
- Every test must fail if the code it covers is broken. Would it still pass if every import returned `undefined`? Then rewrite it.
- Match the project's existing test style and tools.

**Success checks.** {test command} passes · each new test shown failing against a deliberately broken version (describe how you checked).

**Out of scope.** Changing production code. If a test reveals a bug, report it.
