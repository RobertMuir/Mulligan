# Bug brief

**Symptom.** {what happens} instead of {what should happen}

**Reproduction.** {exact steps, input or command} — observed {output, error, screenshot}

**Where.** {surface: UI / CLI / API} · suspected code: {files, symbols} · started around: {commit, release, or unknown}

**Known so far.** {hypotheses ruled out, with evidence}

**Do.**
1. Reproduce it and observe how the failure happens before changing any code.
2. Write a check that fails for this reason (if there is a cheap one).
3. Fix at the cause, not with a guard that hides the symptom. Search for the same mistake elsewhere.

**Success checks.** The reproduction now passes · {regression test} fails before and passes after · {existing suite} still passes.

**Out of scope.** Refactors and unrelated fixes — list them instead.

**Report.** The cause, the fix, before and after output, and anything still uncertain.
