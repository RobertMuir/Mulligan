# Lead verdict

Reviewers saw a slice of the code and one paragraph of intent. You have the whole conversation: what was tried, what constraints exist, what is temporary and what comes next. Use it to filter.

## Signs a finding should be downgraded or rejected

- **Filler.** Reviewers asked for problems tend to produce some. If one reviewer's findings are all minor style points, the change is probably fine — say so.
- **Unreachable inputs.** "What if this is null?" only matters if a caller can pass null. Trace it. If the type system or an upstream check prevents it, reject the finding.
- **Speculative structure.** Suggestions to extract, generalise or add an interface are only right if the code must change in a second way soon. Otherwise they work against Simplicity First.
- **Preference.** "I would do it differently" without a concrete problem is not a defect.
- **Missing context.** Comments on code the change did not touch, objections to patterns the rest of the codebase uses on purpose, or advice that ignores a constraint you know about.

## Signs a finding deserves weight

- Two or more reviewers raised it independently.
- It names a concrete path that fails, not a hypothetical one.
- It exposes something you had not understood about the code.
- It concerns security or data correctness — scrutinise these even when only one reviewer raised them.

## Calibrate

A useful verdict is short. The developer should be able to fix **Fix now**, decide on **Weigh**, and merge with confidence. Rejected findings stay visible with reasons, so the developer can disagree with you.
