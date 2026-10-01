---
name: create-verification-skill
description: Write a skill, kept in this repository, that operates the app the way a user would — launch it, use a feature, record what happened, shut it down — for any stack, and plug its unattended checks into Mulligan's verification commands. Use for /create-verification-skill, or when nothing in the repo can demonstrate that the app actually works.
---

# Create a verification skill

Mulligan only trusts evidence, and evidence needs a reliable way to operate the real app. This skill produces that recipe for this repository. Write it for an agent who has never seen the project and opens the skill halfway through some other task.

## 1. Study the repository

Get these from the code and docs first; only ask the developer for what the repository cannot tell you.

- **Interface** — where does a user interact: browser UI, command line or terminal UI, desktop window, HTTP API, phone app, imported library? Choose the main one and list any others.
- **Launch** — how the project itself says to start it locally (see the README, the scripts in `package.json`, any Makefile), plus ports, environment variables, seed data and login.
- **Control** — reuse what exists (Playwright or Cypress suites, API clients, scripted terminal sessions). Only if nothing exists, pick the simplest general route: browser automation for web and Electron, a pseudo-terminal or tmux for CLIs, plain HTTP calls for services.
- **Proof** — what can be recorded: captured screens, CLI output, HTTP responses, log lines, process status codes, rows in the database, files written.
- **Parallel runs** — would a second copy collide with the first (same port, same data folder, same browser profile)? If so, the skill must say it refuses to operate an instance someone else is using rather than risk damaging their session.

If the checkout does not build or launch, sort that out first or report precisely what is broken. Instructions recorded against a broken checkout will be wrong.

## 2. Write the skill

Create `.claude/skills/verify-<app>/SKILL.md` (in Cursor, `.cursor/skills/verify-<app>/SKILL.md`). Give it frontmatter: `name: verify-<app>`, plus a description that says which app, which interface, and the moments an agent should reach for it. Fill every section with commands that really work in this repository:

- **Launch** — the exact command, and the signal that it is ready (a log message, a port answering, a prompt). For a short-lived CLI, there is nothing to keep running: build once, then give each run its own isolated terminal session.
- **Health check** — a single read-only check that this instance is the right one and usable: the expected process, the expected build, the port belongs to us, the login works. Run it before the first use and whenever something behaves oddly.
- **Operate** — step-by-step harness instructions using this app's real identifiers. Prefer handles that survive redesigns: accessible names, test ids, route paths, prompt text. Avoid screen coordinates and tab order.
- **Record** — what to keep as proof and where. Use the path a real user takes, not internal shortcuts or test-only endpoints. Record both what was done and what it produced. Check side effects (files, rows, sent messages) as well as what is on screen. If you rely on a dry-run mode, confirm by observation what it really skips.
- **Shut down** — stop only what this run started; never kill processes by name. Shutting down removes instances and scratch data and leaves the proof in place.
- **Helpers** — any helper script must be runnable as-is (executable bit set), with the exact command to run it written in the skill.

## 3. Map the features

Add `features/README.md` as an index and one file per user-facing feature — begin with the three to five most important, found from routes, commands, menus or docs. For each, from the user's side: what it does, how a user gets to it, the harness steps to operate it, the end state that proves it worked, and known traps.

## 4. Connect it to Mulligan

Any part of the proof that runs unattended and exits non-zero on failure belongs in `.mulligan/config.yaml` under `verification.commands`. Then Mulligan Review reports it and every fan-out candidate is checked with it in its own sandbox. Offer to pre-approve those commands (`/permissions approve <command>`); that choice is the developer's.

## 5. Run it once before handing it over

Follow the new skill from start to finish: launch, health check, operate one mapped feature, record proof, shut down. Then check that the proof is still where the skill says it is. Fix whatever fails, shutting down after each failed attempt so nothing is left running. Until it has been run successfully, the skill is only a draft.

Finish by pointing the developer to **maintain-verification-skill** to keep it current.
