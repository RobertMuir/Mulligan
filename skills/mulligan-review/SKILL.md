---
name: mulligan-review
description: Comprehensive engineering review of the current changes — first against the four Karpathy principles (Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution), then the project's cookbook, Mulligan Memory, golden PR patterns, security, blast radius and verification. Use before creating or submitting a PR, or when the developer asks for a Mulligan Review. Produces actionable, evidence-backed findings — never a score.
---

# Mulligan Review

Review the current change the way a careful senior engineer on *this* team would, then hand the decision back to the developer.

## Non-negotiables

- **Never output a score.** No "8/10", no grades. Findings, evidence, actions.
- **Every finding cites evidence:** `file:line`, a rule id (`TS-001`, `MM-003`, `GP-002`), a command result, or a quoted diff line.
- **The Karpathy principles are always reported** — all four, every review, even when one cannot be assessed (then say why).
- **Respect the standards hierarchy** when sources disagree — the higher level wins:
  1. Human explicit instruction · 2. Regulatory/safety requirement · 3. Project cookbook · 4. Project architecture · 5. Mulligan Memory · 6. Golden PR patterns · 7. Framework best practice · 8. General best practice · 9. Model preference
- **Your own opinion is level 9.** It may raise attention; it never blocks on its own. Label it as model opinion.
- **Memory is learned preference, not law.** If the change looks like a justified exception to a `.MulliganMem` principle, say so.
- **Say what you did not verify.** "No blocking issues identified" is not "perfect".
- **Do not fix anything during the review** unless the developer asks.

## The Karpathy principles

| Principle | What the engine checks | What you add by reading |
|---|---|---|
| **Think Before Coding** | The task or PR description states assumptions, alternatives, trade-offs or open questions | Did the change silently pick one reading of an ambiguous requirement? |
| **Simplicity First** | New exports nothing uses; new classes or layers (Factory, Strategy, Manager, …) with a single use; very large additions | Speculative features, unrequested options, handling for impossible cases; could it be half the size? |
| **Surgical Changes** | Whitespace-only edits, removed existing comments, small edits outside the change's main area | Drive-by refactors, renamed things nobody asked about, style changes, rewritten comments |
| **Goal-Driven Execution** | Tests changed or verification passed; success criteria stated | Do the tests actually prove the goal — would they fail if the code were wrong? |

## Workflow

1. **Run the engine first.** Terminal: `Mulligan review --task "<what this change is for>"`. Agent: the `mulligan_review` tool.
   Useful options: `--description-file PR.md` (enables the Think Before Coding and success-criteria checks and the golden PR checks), `--scope "src/feature/**"` (declares the intended scope), `--base <branch>`, `--all`, `--verbose`.
   Verification commands from `.mulligan/config.yaml` run through the permission layer.
2. **Read the context the engine used:** `.MulliganMem`, `.mulligan/cookbook/*.yaml`, `.mulligan/golden-pr/principles.yaml`, and the diff (`git diff <base>...HEAD` plus uncommitted work).
3. **Add judgement** where the engine cannot see: the right-hand column above, cookbook rules without a `check:`, correctness against the stated task, architecture, performance, observability, accessibility beyond pattern checks. Cite the lines for each.
4. **Check blast radius:** unrelated files, dependency changes, config, CI and migration changes, public API changes without docs. Use **digging-it-out-of-the-dirt** for anything that looks risky.
5. **Resolve conflicts explicitly** with the hierarchy. Print the `CONFLICT DETECTED` block and ask whether Mulligan Memory should be updated. Never edit memory yourself.
6. **Safety mode** (`mode: safety`) adds TRACEABILITY, DATA INTEGRITY, FAILURE MODES, AUDITABILITY, RISK CONTROLS, REPRODUCIBILITY and CHANGE CONTROL. Anything not evidenced goes under *Human review areas*.

## Output

```text
MULLIGAN REVIEW

Status:
BLOCKING ISSUES | CHANGES REQUIRE ATTENTION | NO BLOCKING ISSUES IDENTIFIED

KARPATHY PRINCIPLES
✓/⚠/✗/– THINK BEFORE CODING
✓/⚠/✗/– SIMPLICITY FIRST
✓/⚠/✗/– SURGICAL CHANGES
✓/⚠/✗/– GOAL-DRIVEN EXECUTION
    <finding>  (<file:line>)

<CATEGORY>
✓ / ⚠ / ✗ <finding>  (<file:line or rule id>)

Unverified
- <what was not checked and why>

Human review areas
1. <decisions only a human should make>

Recommended actions
1. <specific, ordered: blocking first>
```

Other categories: CORRECTNESS, ARCHITECTURE, TYPESCRIPT, JAVASCRIPT, REACT, REACT NATIVE, TESTING, SECURITY, PERFORMANCE, ACCESSIBILITY, MAINTAINABILITY, ERROR HANDLING, OBSERVABILITY, DEPENDENCIES, DOCUMENTATION, BLAST RADIUS, PR QUALITY, PROJECT-SPECIFIC STANDARDS, MULLIGAN MEMORY ALIGNMENT. Omit those with nothing to say and list them under "Not assessed".

End with: the developer decides. If the approach itself is wrong, suggest taking a Mulligan.
