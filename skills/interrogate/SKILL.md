---
name: interrogate
description: Stress-test a change with several independent reviewers on different models, each applying the same brief — the Karpathy principles, the project's standards and an adversarial correctness lens — then sort every finding into what to fix, weigh, log or reject. Use for "interrogate", "challenge this", "adversarial review", "multi-model review".
---

# Interrogate

Independent reviewers on different models catch different real problems. Agreement between them is the strongest signal you get. The output is a verdict for the developer. **Never apply changes yourself.**

## 1. Gather the change

- Files or a diff the developer named; otherwise the branch against its base (`git diff <base>...HEAD`) plus uncommitted work.
- The surrounding code reviewers need: callers, types, tests.
- Run `mulligan_review` first. Its evidence (cookbook violations, Karpathy checks, verification results) goes to every reviewer.

## 2. State the intent

One paragraph: what this change is for, drawn from the developer's words, commit messages and the PR description. If the intent is unclear, ask before reviewing. Reviewers judge whether the change achieves the intent, not whether the intent is right.

## 3. Brief the reviewers

Send the same brief — [references/reviewer-brief.md](references/reviewer-brief.md), the intent, the change and the Mulligan Review evidence — to one reviewer per available model. Use the models Mulligan has configured (`route_task` shows them); prefer different providers. Run them in parallel. Reviewers are read-only.

## 4. Merge the findings

- Combine findings that describe the same problem, and record which reviewers raised it.
- Raised by two or more reviewers independently → highest signal.
- Raised by one → still read it; weigh it on its merits.
- Where reviewers contradict each other, keep both views.

## 5. Judge

You are the lead reviewer, not a vote counter. Apply [references/lead-verdict.md](references/lead-verdict.md) and put every finding in exactly one bucket:

- **Fix now** — a real problem with correctness, security or maintainability that would block a careful team's PR.
- **Weigh** — a fair point whose cost-benefit is the developer's call.
- **Logged** — valid but not worth acting on now.
- **Rejected** — wrong, out of context, or preference dressed as a defect, with the reason.

Keep **Fix now** short. If it has more than five items, you are not filtering hard enough.

## Report

- **Intent** — the paragraph from step 2.
- **Reviewers** — model and number of findings, one line each.
- **Fix now**, **Weigh**, **Logged**, **Rejected** — each finding with its location, who raised it, and a one-line reason for its bucket.
- **Where reviewers agreed and disagreed** — and what that suggests.

Listing rejected findings with reasons gives the developer the chance to overrule you; it is part of the verdict, not padding.
