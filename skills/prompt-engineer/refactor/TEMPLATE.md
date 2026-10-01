# Refactor brief

**Target shape.** {what the structure should be afterwards, and why it is easier to follow}

**Behaviour must not change.** Pinned by: {characterisation test, snapshot, output-recording script}

**Scope.** {files and modules} — callers to migrate: {list}

**Do.**
1. Remove dead code and one-caller wrappers first.
2. Move in small steps; the pin stays green after each.
3. Switch all callers to the new API and remove the old one within this same change.

**Success checks.** The pin passes unchanged · {type check} · {test suite}. Renames checked in strings and docs.

**Out of scope.** Any behaviour change. If you find a bug, report it separately.

**Report.** What moved, the proof behaviour held, and what you would revert if it does not make the code easier to read.
