# Review brief: mulligan-delegation

Follow `D:/Personal Projects/Mulligan/skills/interrogate/references/reviewer-brief.md` for lenses and finding format. Intent and decisions: `shared.md` in this folder.

## Change

`git diff HEAD -- . ':!dist'` plus two new files: `skills/mulligan-mode/delegation.md`, `skills/mulligan-mode/references/handoff.md`. Changed files:

agents/mulligan-agent.md, agents/mulligan-reviewer.md, skills/mulligan-mode/SKILL.md, skills/mulligan-mode/playbooks/feature.md, skills/interrogate/SKILL.md, skills/interrogate/references/reviewer-brief.md, skills/how/SKILL.md, skills/reflect/SKILL.md, skills/maintain-verification-skill/SKILL.md, skills/prompt-engineer/SKILL.md, skills/principle-spend-on-the-change/SKILL.md, skills/setup-mulligan/SKILL.md, packages/core/src/workspace.ts, packages/core/src/config-validation.ts, packages/core/test/core.test.ts, packages/core/test/config.test.ts, .gitignore, .claude-plugin/plugin.json, .claude-plugin/marketplace.json, .cursor-plugin/plugin.json

Read only these, plus what they directly reference when you need it to judge correctness (e.g. `skills/attacking-the-pin/SKILL.md` for how race candidates use mulligan-agent). Do not explore further.

## Evidence already gathered (mulligan_review)

Karpathy: no assumptions/success criteria stated in a PR description (none exists yet); 7 comment lines removed (2 are a reworded doc comment in workspace.ts, rest are dist minifier churn); no unused abstractions; tests updated; no security pattern hits; changes inside scope. Not assessed: correctness. Do not re-run it.

## Focus

Contradictions between files (e.g. SKILL.md step 5 vs delegation.md vs mulligan-agent.md vs attacking-the-pin), instructions a worker or lead could misread, and anything that would make delegation more expensive, not less.
