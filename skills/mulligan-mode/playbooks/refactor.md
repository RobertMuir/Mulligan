# Refactor

The structure changes; the behaviour does not. If the work turns up a bug or a missing feature, split it out — land the structural change first.

1. **Pin current behaviour** before moving anything: a characterisation test, a snapshot, or a script that records outputs. A clean type check or lint run does not count — neither says anything about behaviour.
2. **Name what is missing** — the structure that would remove branches or impossible states (Encode the domain). If the current code is already clear and local, stop: there is nothing to refactor.
3. **Describe the target** as if writing it today. If it crosses a function boundary, sketch it with **architect**.
4. **Remove before you build:** dead code, one-caller wrappers, redundant checks.
5. **Move in small steps,** keeping the pin green after each. When reshaping an API, switch all callers over and remove the old API within the same change (One API at a time). Check renames against strings and docs, which search-and-replace misses.
6. **Prove behaviour is unchanged** against the pin on the real artifact, not just "it compiles".
7. **Keep it only if it helps.** If no one will find the code easier to follow (Readable in thirty seconds), revert it.

**Reply:** what changed structurally, the pin used, the proof that behaviour held, and what was reverted. No new behaviour.
