---
name: typescript-best-practices
description: How Mulligan writes and reviews TypeScript — model states so invalid ones cannot exist, parse untrusted data at the edges, never lie to the compiler, and keep types as simple as the operations allow. Use when reading or editing .ts or .tsx files.
---

# TypeScript best practices

These put "Let the compiler carry it" and "Edges guarded, middle trusted" from the Mulligan principles into TypeScript. The project's cookbook comes first: where it has a rule (for example a `no-explicit-any` check), that rule wins. Examples for every row are in [patterns.md](patterns.md).

| Practice | In short |
|---|---|
| Unions for states | Model each state as its own variant with a literal `status` (or `kind`) field. No bags of optional fields that allow contradictions. |
| Build the shape, don't police it | Choose a representation that cannot hold an invalid value — a non-empty tuple, a start plus a duration — instead of a loose type plus runtime checks. |
| Distinct ids | Brand primitives that must not be swapped (`OrderId` vs `CustomerId`). Create them in one parsing function. |
| `unknown` at the edges | Data from the network, files, storage, environment, `postMessage` or `JSON.parse` is `unknown` until parsed. |
| One schema, derived types | If the project has a schema library (Zod, Valibot, …), write the schema once and let its inferred type be the only declaration. Three hand-kept copies of one shape (schema, interface, guard) will drift. |
| No casts to win arguments | `as` is allowed only after the value has been checked. If you need a cast, ask what the compiler cannot see and show it. |
| Narrow in order of preference | Discriminant check → `in` → `typeof`/`instanceof` → a type guard that really checks → `as` after validation. |
| Honest type guards | An `isX` function must check everything its name claims. A guard that lies is worse than a cast because it looks safe. |
| Exhaustive switches | End switches over unions with a `never` check so a new variant breaks the build until it is handled. |
| `satisfies` for config | Check a literal against a type without widening it. |
| Derive, don't duplicate | Reach for `Pick`, `Omit`, `ReturnType`, `Parameters`, `Awaited` and `typeof` before writing a new interface that copies another. |
| Simplest honest type | A plain array is fine as long as nothing you do with it breaks on an empty one. Tighten the type only where its looseness forces `!`, a cast or "cannot happen". |
| Options objects | Functions with several parameters of the same type take one object, so arguments cannot be swapped silently (not on hot paths). |
| Real tests | Test with real code paths; mock only what cannot run locally. Assertions compare against literal expected values. |
| Structured logging | No `console.log` in shipped code; use the project's logger, and include the ids needed to trace a problem later. |

When a change needs `any`, a cast or `!`, treat it as a design question for the developer, not a typing chore. A documented exception uses the cookbook's form: `// mulligan-allow TS-001: <reason>`.
