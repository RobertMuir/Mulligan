# Shared: mulligan-delegation

Goal: Mulligan delegates code to `mulligan-agent` workers by itself when a task splits into 2+ qualifying units, and cheaply: the lead writes contracts first, writes shared context once to `.mulligan/handoffs/<task>/shared.md`, and each worker reads a short handoff instead of exploring.

Decisions already made by the developer (do not re-litigate; flag only if the change implements them wrongly):
- Delegation is automatic at **any** difficulty tier once Mulligan mode is invoked (`units` mode), overriding PR #1's "self up to tier 3" for splittable code. Small/one-unit work stays inline.
- Fixed limits: ≤4 workers/wave, workers default to Sonnet, one fix round via SendMessage, scoped checks for workers, one reviewer by default.
- Workers never delegate. Worker instructions live in `agents/mulligan-agent.md` and the handoff, not in `mulligan-mode/SKILL.md`.
- A per-project switch `loop.delegation: { mode: auto|ask|off, maxWorkers, workerModel }` in `.mulligan/config.yaml`.
- Plugin manifests move to 0.2.0.
- Cursor docs list `model` values `inherit`, `fast` or a model id; so the lead always passes `workerModel` explicitly and Cursor projects set `fast`.

Context: `principles.md` no longer exists — principles are `skills/principle-*/SKILL.md` leaf skills. Race candidates (attacking-the-pin) and the `single` delegate also use `mulligan-agent`.

Checks already run: `pnpm typecheck` exit 0; `pnpm test` 112/112 pass; core.test gitignore assertion fails with the workspace.ts line removed; `pnpm build` bundles the new path. The dist/*.mjs diffs are minifier renames from the rebuild — skip them.
