---
name: principle-surgical-changes
description: "Apply to every diff. Change only what the task needs, keep the existing style, and report unrelated problems instead of fixing them."
user-invocable: false
---

# Surgical Changes

Every changed line traces back to the request. Keep each file's existing style even where yours differs, and leave neighbouring code, comments and formatting alone.

**Why.** A diff the developer can read in one pass gets a real review. Drive-by edits hide the change that matters and widen what could break.

**In practice.**
- Before editing, name the files you will change and why.
- Use targeted edits; never rewrite a file to change a few lines.
- Spotted unrelated dead code or a bug? Mention it in the hand-back; do not fix it.
- Do clean up what your own change orphaned: imports, variables and helpers it made unused.

**In the Mulligan loop.** Any file changed outside the area the task names is listed in the hand-back with its reason.

**Not when.** A refactor the developer asked for is the task, not a drive-by.

**Check.** Can every changed line be traced back to the request?
