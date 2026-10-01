---
name: setup-mulligan-pr
description: Connect Mulligan to the developer's pull-request platform (GitHub, GitLab, Bitbucket, Azure DevOps, other) and establish what an excellent PR looks like for this team by analysing 3–10 developer-chosen Golden PR examples and merged-PR review feedback. Use when the developer wants PR-aware reviews or asks to set up golden PRs.
---

# Setup Mulligan PR

There is no universal "perfect PR". A **Golden PR** is a developer- or team-chosen example
of excellent work. Mulligan learns *what excellent looks like here*.

## Non-negotiables

- **Do not assume GitHub.** Ask which platform.
- **Never ask the developer to paste a token into the conversation.** Tokens come from
  environment variables (`GITHUB_TOKEN`/`GH_TOKEN` or `gh auth login`, `GITLAB_TOKEN`, …) and
  are never written to Mulligan files. Read-only access is enough.
- **Observed patterns are not universal truth.** Report each with its support
  ("seen in 4/5 golden PRs").
- **Nothing enters `.MulliganMem` without the developer's confirmation.** Golden principles
  and review-comment lessons become *candidates*.

## Workflow

1. Ask: *Which PR platform do you use?* — GitHub · GitLab · Bitbucket · Azure DevOps · Other.
   (GitHub and GitLab are implemented; others plug in via the `PullRequestProvider` interface.)
2. Confirm the repository (default from `git remote get-url origin`).
3. Check a token is available in the environment; if not, tell the developer which variable
   to set and stop until they have.
4. Ask for Golden PRs:

   > I'd like to learn what an excellent PR looks like for your team.
   > Please provide 3–10 PRs that represent your highest standard of engineering.

   Accept URLs, numbers, or a pick from recent merged PRs. For each, optionally ask *why* it
   is golden — the developer's reason is the strongest signal.
5. Analyse each PR: description structure (problem, summary, testing, risks, rollback,
   migration, screenshots), size, files, tests, docs, commits, reviewer comments, requested
   changes, and the merged result.
6. Extract principles present in at least 60% of examples (e.g. small focused changes, explicit
   testing section, screenshots for UI changes, no unrelated refactors, tests with changes).
7. Save to `.mulligan/golden-pr/{examples/, principles.yaml, metadata.yaml}`.
8. Offer the principles as Mulligan Memory candidates.
9. Offer to learn from review comments on recent merged PRs:
   review comment → developer correction → accepted merged implementation → candidate lesson.
   Keep the reviewer's words; ask the developer whether each becomes a project principle.

The interactive CLI implements this flow:

```bash
Mulligan setup-mulligan-pr
```

## Output

Summarise: platform and repository connected, number of golden examples, the observed
principles with support counts, and how many candidate lessons await `/memory review`.
