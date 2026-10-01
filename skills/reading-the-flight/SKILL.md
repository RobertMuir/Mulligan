---
name: reading-the-flight
description: Find out why code is the way it is — the decision, the incident, the constraint or the trade-off behind it — from git history, PRs, tickets, docs, chat and production data, with every claim labelled by how well it is supported. Use for "why do we do X", design rationale, regressions, and before changing code whose purpose is unclear.
---

# Reading the Flight

*In golf terms for finding out why code is the way it is.*

Code shows what it does, never why it exists. The reasons live in commits, pull requests, tickets, documents, conversations and production data — all partial, some missing. Your job is to recover them honestly, and to say plainly where they cannot be found.

## 1. Pin down the target

Identify the code (files, lines, symbols) and the question: a design choice, a threshold, a defensive check, a regression, dead-looking code. If the target is vague, take your best reading from context, state it in one line, and continue.

## 2. Anchor in history

```bash
git blame -L <start>,<end> <file>
git log --follow --oneline -- <file>
git log --follow -p -- <file>
git log -1 --format=%B <commit>
```

Collect the commits that touched the target, the pull requests they came from, and any linked tickets. Read PR descriptions and review threads (the `gh` CLI, or the PR provider Mulligan is connected to).

## 3. Search every available source

Check which tools and MCP servers you can reach, and search each kind of evidence that exists here:

| Source | What it tends to explain |
|---|---|
| Version control and PRs (always available) | decisions made during review |
| Issue tracker | the product or business reason |
| Design docs and wikis | reasoning written down before the code |
| Team chat | discussions that never reached a document |
| Monitoring and logs | the runtime problem the code reacts to |
| Error tracking | the exceptions behind a defensive check |
| Analytics or data warehouse | where a number or threshold came from |

Search them in parallel when you can. For defensive code (retries, timeouts, null checks, limits, feature flags), look specifically for the incident that caused it. When a source is unavailable or turns up nothing, record that — an empty search is a result.

## 4. Grade every claim

| Grade | Meaning | How to say it |
|---|---|---|
| **Stated** | Someone wrote the reason down (PR, ticket, doc, comment, message) | "This exists because … (source)" |
| **Corroborated** | Several indirect sources point the same way | "The evidence points strongly to … (sources)" |
| **Interpreted** | A reasonable reading with nothing explicit behind it | "It appears…", "likely…", with the chain of reasoning |
| **Conjecture** | Plausible, but other explanations fit as well | "One possibility is … — no direct evidence" |
| **Not found** | You looked and could not tell | "Searched A, B and C for D; nothing explained it" |

Rules:
- Words like "because", "was designed to" and "fixes" need a citation right next to them.
- The code is not evidence of its own purpose.
- If the developer's question contains a guess ("I assume it's for performance?"), test it like any other hypothesis. Do not just agree.
- When sources disagree, show both.
- The newest commit is not automatically the reason; the shape is usually built up over many changes.

## 5. Report

- **Question** — and the code examined, with paths and lines
- **Established** — stated and corroborated claims, each with its source
- **Likely** — interpreted claims, each with its chain of reasoning
- **Other explanations** — conjecture, side by side
- **Unknown** — and who could answer (the author, the product owner)
- **Where we looked** — one line per source, including the empty ones and the unavailable ones

If the developer is about to change this code, finish with constraints for the change: **Preserve** (what the history shows must stay), **Free to change**, **Avoid** (what was tried and failed), **Risk** (what the original reason suggests could break).
