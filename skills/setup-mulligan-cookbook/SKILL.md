---
name: setup-mulligan-cookbook
description: Interview the developer/team to create a Coding Standards Cookbook — how THIS team wants software written (TypeScript, JavaScript, React, React Native, testing, architecture, security, documentation, pull requests, AI guardrails). Use when setting up Mulligan on a project or when the developer wants to record team standards that Mulligan Review will enforce.
---

# Setup Mulligan Cookbook

The cookbook answers one question: **"How does OUR team want software written?"**
It is distinct from generic best practice and sits above it in the standards hierarchy
(level 3 — only human instruction and regulatory requirements outrank it).

## Non-negotiables

- **Use the developer's words.** Do not "improve" a rule into generic advice.
- **Starter rules are suggestions.** Offer them; adopt only what the developer accepts.
  Mark adopted ones `origin: starter`.
- **Ask about exceptions.** A rule without its exceptions becomes dogma.
- **Do not invent severity.** Prohibited patterns and past problems default to `high`,
  PR-rejection criteria and AI guardrails to `blocking`, preferences to `medium` — confirm
  with the developer when unsure.

## The interview

For each chosen category (typescript, javascript, react, react-native, testing,
architecture, security):

1. What does excellent <category> look like to you?  → `philosophy`
2. What patterns do you prohibit?                    → `high` rules, `prohibited`
3. What patterns do you prefer?                      → `medium` rules, `preferred`
4. What exceptions exist?                            → `exceptions`
5. What practices have caused problems previously?   → `high` rules with rationale

Then, once for the project:

6. What would make you reject a PR?                  → `pull-requests.yaml`, `blocking`
7. What should an engineer always explain?           → `documentation.yaml`
8. What should an AI never change without asking?    → `ai-guardrails.yaml`, `ai_must_ask: true`

The CLI runs this interview and writes the files:

```bash
Mulligan setup-mulligan-cookbook
```

## File format

`.mulligan/cookbook/<category>.yaml`:

```yaml
category: typescript
philosophy: Types document intent; runtime uncertainty is explicit.
rules:
  - id: TS-001
    title: Avoid any
    severity: high          # blocking | high | medium | low
    rule: Do not use `any` unless there is a documented reason.
    preferred: [unknown, explicit interface, discriminated union]
    exceptions: [third-party library boundary]
    rationale: Preserve type safety and make runtime uncertainty explicit.
    check: { type: builtin, name: no-explicit-any }   # optional machine check
```

**Checks.** Builtins: `no-explicit-any`, `no-non-null-assertion`, `no-empty-catch`,
`no-ts-ignore`, `no-console`, `no-default-export`, `no-index-key`, `max-file-lines`.
Or a pattern: `{ type: pattern, pattern: "<regex>", files: ["**/*.tsx"] }`.
Rules without a check are reviewed by human/model judgement and listed as such.

**Documented exceptions in code:** `// mulligan-allow TS-001: <reason>` on or above the line.
A suppression without a reason is still reported.

## After the interview

Show the developer every rule written, grouped by file, and offer to add `check:` blocks
for rules that can be enforced mechanically.
