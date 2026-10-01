---
name: maintain-verification-skill
description: Keep a repository's verification skill truthful as the app evolves — compare every mapped feature with the current source, operate each one in the live app, and submit no more than one change, containing only corrections you have demonstrated. Use for /maintain-verification-skill or "is the verify skill still accurate?".
---

# Maintain a verification skill

Every release can quietly invalidate the instructions in a verification skill. This routine finds where the skill and the app have drifted apart and repairs the skill. Work feature by feature: each one is read in the source and exercised live.

## Possible results

Finish with one of these and state it:

- **Accurate** — every feature was read and exercised, and nothing needed fixing. No branch, no change.
- **Corrected** — a single change containing fixes you demonstrated to the skill, its feature files, its scripts or its entries in `verification.commands`.
- **Stuck** — something prevented full coverage or a safe fix. Name exactly what.

## Boundaries

Edit only the skill's own folder (its `SKILL.md`, `features/`, its scripts) and the matching `verification.commands` entries in `.mulligan/config.yaml`. Leave product code alone. When the app and the skill disagree, decide which one moved: a stale description is fixed in the skill; an app that has stopped working is reported to the developer as a bug, never papered over in documentation.

## Routine

0. **Locate the skill.** Look for a repository-level verification skill with launch and operate sections and a feature folder. Several candidates: ask which. None: recommend **create-verification-skill** and end here.
1. **Tidy the index.** Compare `features/README.md` with the files beside it; fix entries that are absent, surplus, repeated or broken.
2. **Read each feature in the source.** Where you can, give each feature file to its own read-only subagent. Each reports back: how the feature works today, where in the code it starts, anything the feature file now gets wrong (cited), and one recipe for exercising it live. These subagents never operate the app and never edit files.
3. **Combine the reports.** Every feature must have one. Group recipes that need the same app state. Spot-check reported drift yourself. Scan recent commits for user-facing features the map lacks — and only call one missing once you can point at the code for it.
4. **Exercise every feature in the running app**, including those whose source looked fine. Launch the way the skill itself prescribes. For the whole session, keep three promises:
   - never operate an instance that has not passed its health check since its last surprise — check it at the start, after anything odd, and after any failed step, or reset it to a known state;
   - every piece of proof gathered so far survives every shutdown;
   - whatever a step started is stopped once it has served its purpose.
   Mark a feature "unreachable" only when you can name the exact precondition it requires (an account, a licence, an operating system, an outside service) and what you tried. If the feature file never mentions that precondition, that omission is itself drift.
5. **Classify each problem.** The description is wrong or incomplete → fix the feature file. The app works but the harness cannot operate it → fix the harness and exercise that feature again. The app itself is broken → note it for the developer, outside this change.
6. **Finish.** For **Corrected**, re-read every edited file, then submit the one change. For **Accurate** or **Stuck**, submit nothing and report the result and how much was covered.

Keep short working notes — features covered, unreachable preconditions, drift confirmed, result — in the session folder, never in the repository.
