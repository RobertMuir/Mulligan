# Handoff: <unit name>

Task: `<task-slug>`. Also read `shared.md` in this folder first.

## Build

<One paragraph: what this unit does and for whom. Name the behaviour, not the steps.>

## You own

Create or edit only these files:

- `<path>`
- `<path>`

## Contract

Implement exactly this. If it is wrong, stop and report rather than changing it.

```ts
<exported types and signatures this unit provides>
```

You consume these (signatures only; the implementations may still be stubs):

```ts
<signatures from other units or existing code>
```

## Read first

Read these and the principle skills your agent instructions name; do not explore beyond that. If you are blocked, stop and report.

- `<path>`: <why it matters>
- `<path>:<from>-<to>`: <why it matters>
- House pattern to copy: `<path>`

## Decisions already made

- <decision>: <one-line reason>

## Pitfalls already found

- <pitfall, e.g. "type errors in files other workers are writing are expected; ignore them">

## Done when

- `<command scoped to your files>` → <expected result>
- `<command>` → <expected result>

## Report

At most 250 words, plus the check-output lines that matter:

1. **Files changed.**
2. **Checks:** each command with its result, marked PROVEN, FAILED or UNPROVEN.
3. **Not verified,** and why.
4. **Contract problems or decisions for the lead.**
