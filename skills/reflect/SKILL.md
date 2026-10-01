---
name: reflect
description: At the end of a substantial session, mine what happened for durable lessons — corrections, surprises, wasted effort, things that worked — and route each to where it will actually hold: Mulligan Memory, a cookbook check, a skill edit, or a structural guard. Nothing is applied without the developer. Use for /reflect or "what did we learn?".
---

# Reflect

A lesson that lives only in a conversation is lost when the conversation ends. Reflection captures it and puts it where it will change the next session. One-off details are not lessons; skip them.

## 1. Gather the session

Use the current conversation, the session log (`.mulligan/sessions/<id>/`), attempts, fan-out reports and Mulligan Review results. Note especially:
- every time the developer corrected you or took a Mulligan, and why;
- anything that took far longer than it should have;
- checks that were missing, flaky or misleading;
- approaches that worked and should be repeated.

## 2. Look through three lenses

Use separate subagents or models for these when you can — each sees different things:

- **Judgement** — decisions that were wrong or slow to get right; principles that were missed or misapplied.
- **Tooling** — commands, scripts, checks or skills that were missing, broken or awkward; what could be automated.
- **Contrarian** — what everyone, including you, took for granted; the lesson nobody would think to write down.

Each lens returns findings with the evidence from the session.

## 3. Route each finding to the strongest home

Pick the strongest mechanism that will enforce it (Turn corrections into checks):

| Kind of lesson | Home |
|---|---|
| Can be made impossible in code | A type or API change |
| Mechanically checkable | A cookbook rule with a `check:` (or a lint rule) |
| A preference needing judgement | A Mulligan Memory candidate |
| A workflow improvement | An edit to a Mulligan skill |
| A missing proof of behaviour | The project's verification skill or `verification.commands` |

Drop findings that are one-offs, already covered, or not supported by the session.

## 4. Present, then apply what is approved

Show the developer the full list — **proposed**, **dropped** (with reasons), and **later** (worth doing, not now). Apply only what they approve. Memory candidates are proposed, never confirmed on their behalf.

## Report

One line per change made, per item deferred, and per finding dropped with its reason.
