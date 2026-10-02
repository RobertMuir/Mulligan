---
name: how
description: Explain how part of the codebase works — its flow, its key pieces, where things live and what will surprise a newcomer — at the depth a senior engineer needs before changing it. Use for "how does X work", walkthroughs, and "where should this live / which layer owns this".
---

# How

Build the developer a working mental model of a part of the system: enough to change it with confidence, not a line-by-line tour.

## 1. Size the question

State your reading of the question in one sentence so the developer can redirect you.

- **Narrow** — one function, one module, one behaviour. Explore and explain in one pass.
- **Wide** — a subsystem across several files or services, or a cross-cutting feature. Split it into two to four angles (for example: entry points and triggers; the data and its changes; boundaries with other systems; failure and edge paths) and explore each separately, then combine. Give an angle to a read-only subagent only when it covers more code than you want in your own context; name the files to start from and cap its report at 250 words, so it does not re-read what you already know.

When unsure, treat it as narrow.

## 2. Explore from the code, not from names

For each angle:

1. Find where the behaviour starts: a user action, a request, a job, an event.
2. Follow the calls and read each function. Track what data flows and how it changes.
3. Read the definitions of the central types. A name tells you intent; the code tells you behaviour.
4. Find the edges: what enters, what leaves, which other systems are involved.
5. Note anything surprising, historical or easy to get wrong.

If you cannot trace something, write "could not trace X" — never fill the gap with a guess.

## 3. Combine

Merge what the angles found. Where they disagree, read the code again and settle it. Keep `file:line` references for every claim.

## 4. Explain

Use these sections, dropping any that add nothing:

- **Overview** — what it is, what it is for, in a paragraph someone could stop after.
- **Key pieces** — the types, modules and services the rest depends on, one line each.
- **How it works** — the flow from trigger to result, in prose, naming the real functions and files. Add a diagram when three or more parts talk to each other; skip it when prose is clearer.
- **Where things live** — the handful of files someone would open first.
- **Surprises** — non-obvious behaviour, traps, history worth knowing.

Write concretely: "`syncQueue.flush()` calls `api.post()` for each pending item", not "the queue hands work to the API layer". Where the code is genuinely complicated, explain what makes it so.

## Placement questions

For "where should this live?", answer from the existing ownership: which module already owns the data, the rules, or the boundary involved, and what would leak if the code went elsewhere. Check Mulligan Memory and the cookbook's architecture rules for a recorded preference.
