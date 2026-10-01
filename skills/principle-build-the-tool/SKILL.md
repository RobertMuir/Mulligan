---
name: principle-build-the-tool
description: "Apply to any work beyond a few obvious edits: sweeps, migrations, repeated checks. Write the script, codemod or check that does or proves the work."
user-invocable: false
---

# Build the Tool

For repeated or wide work, build the small tool that does it or proves it: a codemod, a script, a check. Do the first case by hand to learn it, then automate.

**Why.** A tool can be re-run and reviewed; hand edits can only be redone. The developer can trust a tool's output far more cheaply than a hundred manual edits.

**In practice.**
- Keep the tool small and keep it with the work.
- Make the check the tool runs part of verification.

**In the Mulligan loop.** The tool goes in the hand-back so the developer can re-run it.

**Not when.** Three obvious edits do not need a script.

**Check.** If this had to be done again tomorrow, could someone just re-run something?
