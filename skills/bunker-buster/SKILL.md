---
name: bunker-buster
description: "The last resort, for a problem that has beaten everything else: Mulligan mode, repeated Mulligans and the developer's own ideas. Takes one all-out shot that names the assumption every failed attempt shared, throws it out, and builds on its opposite in an isolated worktree on the strongest model. The developer can call it at any time; mulligan-mode takes it automatically, once per task, when the attempts so far are bleak or the problem is tier 5 and an attempt has failed. Use for /bunker-buster, \"hail mary\", \"nothing left to lose\"."
---

# Bunker buster

*In golf terms: the shot out of the bunker you play only when the hole is already lost. At Royal Troon's Postage Stamp in 1973, Gene Sarazen holed one for a birdie. Most of the time it doesn't go in.*

Mulligan normally works carefully: small changes, each one proved, every decision left to the developer. Bunker buster is for when that has run out. It takes **one** shot, built on the opposite of whatever every failed attempt assumed. Expect a miss. A miss that disproves the assumption is still worth having.

## When

- **The developer calls it,** at any time they judge the problem bleak enough.
- **Mulligan mode takes it automatically,** as a last resort, when either trigger is met:
  - **Bleak:** two attempts at this task, Mulligans included, have failed on the same underlying assumption, and putting that assumption to the developer (**take-a-mulligan**, step 6) produced no answer.
  - **Hard:** the task scores tier 5 (**mulligan-mode**, *Models*), and a full attempt has failed its goal check.

  Before an automatic shot, say so in one line: `Bunker buster: <trigger>. Taking one shot in an isolated worktree.` Take at most one automatic shot per task. Another needs the developer to call it.
- **Something has really been tried.** If nothing has failed yet, use **mulligan-mode**.
- **There is a goal check that fails today:** a test, a command or a reproduction. Without one, nobody can tell whether the shot landed. If none exists, write it first. This is the one step bunker buster never skips.

## What the shot suspends, and what it never does

Suspended for the shot only:

- **surgical-changes** and **smallest-sufficient-change**: the shot may rewrite whatever it needs to inside the problem's area;
- following the existing design and patterns, because the design may be the problem;
- **one-verified-step-at-a-time**: the shot is one step;
- **spend-on-the-change**: use the strongest model at its highest effort.

Never suspended:

- **the-developer-decides**: no commit, push, merge, deploy, data deletion, dependency install or Mulligan Memory write, and nothing the cookbook marks `ai_must_ask`;
- isolation: the shot runs in a worktree, and the developer's working tree is never touched. That is the only reason "nothing to lose" is true;
- the private rubric: never open `.mulligan/verification/`;
- honest evidence: a shot lands only when the goal check passes and you ran it. Changing the check, deleting or skipping tests, swallowing the error, or weakening auth or validation to get a pass is a miss, not a landing.

## 1. Read the lie

Write one table of every attempt so far: the approach, why it failed, and the assumption it rested on. Draw on the session, `.mulligan/sessions/`, branches and stashes, and the developer. Ask the developer once for anything they tried that is not on record.

## 2. Find the shared assumption

What did every failed attempt take for granted (**doubt-the-shared-assumption**)? Look for:

- the requirement as stated;
- the layer where the fault lives;
- a library, framework or service behaving as documented;
- the data being what everyone thinks it is;
- the environment matching production;
- the current architecture being a fixed constraint;
- the problem having to be solved in code at all.

Pick the one assumption the most attempts rested on. If an observation that could disprove it takes minutes, run it now.

## 3. Call the shot

Before building anything, write five lines and show them to the developer:

1. **Thrown out:** the assumption, and the opposite this shot is built on.
2. **The shot:** one approach built on that opposite. It must not be a variation of anything in the table.
3. **Landed means:** the goal check passes.
4. **Allowed to break or rewrite:** the files and areas.
5. **Odds:** why it might land, and why it probably won't.

The developer's call or the automatic trigger is the go-ahead, so proceed unless the developer stops you.

## 4. Take the shot, once

- Create a worktree: `git worktree add --detach .mulligan/sessions/bunker/<slug> <base>`. `<base>` is `HEAD`, or what `git stash create` prints when there is uncommitted work (**attacking-the-pin**, *Isolation*).
- Hand the shot to one `mulligan-agent` on the strongest model, passed explicitly. Put its brief inline in the prompt, because handoff files do not exist in a worktree: the worktree path, the goal check, the called shot, the table of failed attempts as off limits, and both lists from *What the shot suspends*. Without subagents, take the shot yourself in the worktree.
- Make one attempt: no fix rounds, no second shot, no fan-out. Close but not in is a miss.

## 5. See where it landed

Read the diff end to end, looking for a gamed check. Then run the goal check, and after it the project's verification commands, in the worktree. The outcome is one of three:

- **Landed:** the goal check passes with no forbidden shortcut.
- **On the green:** the check still fails, but the shot disproved the shared assumption or exposed the real cause. This is often the most useful result.
- **Still in the bunker:** you only learned "not this".

## 6. Hand back and stop

- Save the diff to `.mulligan/sessions/bunker/<slug>.patch`, then remove the worktree.
- Do not apply, polish, refactor or integrate it.
- **Build on it only when the developer says so.** It then goes back through **mulligan-mode** as a new task, with the patch as the starting point and every suspended rule back in force.
- Propose what the shot revealed about the assumption as a Mulligan Memory candidate. Never confirm it yourself.

## Report

- **The lie:** the failed attempts and the assumption they shared, in a few lines.
- **The shot as called:** the five lines from step 3.
- **Outcome:** landed, on the green, or still in the bunker, with the goal check's output.
- **What it touched and broke:** files and lines changed, and which verification commands failed.
- **Not verified,** and why.
- **For the developer:** where the patch is, and whether to build on it.
