# Bug fix

Every line that ships traces to evidence. "This might help" is a hypothesis, and hypotheses do not ship.

1. **See it fail with your own eyes**, through the same interface the user used (UI, CLI, API). If it will not reproduce, tighten the conditions, synthesise the trigger, or add instrumentation until it does. Ask the developer to reproduce only when you can name what blocks you.
2. **Narrow the cause.** List the candidate explanations, then rule them out one at a time with the cheapest decisive experiment. Use **how** for the subsystem and **reading-the-flight** for regression history. When state is unclear, log it and read the log — do not guess. Before fixing, prove how the failure happens by observing it at runtime.
3. **Write the failing check first** when there is a cheap one (the **tdd** skill). It must fail for the reason you found.
4. **Fix at the cause** (Fix where it starts). If the fix crosses a function boundary, sketch it with **architect** first. Search for the same mistake elsewhere.
5. **Confirm where the user saw it:** rerun the reproduction from step 1 and show it now behaves. Unit tests alone show how a branch behaves, not that the bug is gone. An unproven result is reported as unproven.
6. **Review** with **mulligan-review**, then hand back.

**Reply:** what was broken, the cause, the fix, and the evidence — the failing output before and the passing output after, verbatim. If the root cause is still uncertain, say so.
