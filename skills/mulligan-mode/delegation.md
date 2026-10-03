# Delegation

Read this when step 5 chooses **units**. You are the lead: you own understanding, design, contracts, integration and the final verification. Workers (`mulligan-agent`; `Mulligan:mulligan-agent` when installed as a plugin) build one unit each.

## Is it worth a worker?

A worker starts cold. Even with a tight handoff it spends roughly 15–30k tokens reading before it writes a line; a worker given a loose brief and left to explore has spent 100k+. Delegation pays only when the unit is big enough to cover that and runs in parallel with others.

Give a unit its own worker when **all** of these hold:

- **It has real logic:** roughly 60+ lines or its own tests — a hook, a util or domain module, a page, a stateful component, a migration, an Edge Function.
- **Its contract can be fixed before it starts:** you can write its exported types and signatures now.
- **It owns its files:** no other unit writes them.
- **It can be checked alone:** its own tests, or a type-check filtered to its files.

Keep with the lead:

- constants, types and schemas, and the contracts themselves;
- routing and registration, package manifests and config;
- glue under ~30 lines, and anything that touches two units' files;
- fixes found during integration.

If fewer than two units qualify, do not delegate: build it yourself, or use **single** at tier 4–5.

## Settings

`loop.delegation` in `.mulligan/config.yaml` (read in step 2):

- `mode` — `auto` (default): spawn workers without asking. `ask`: show the split — units, owned files, model per worker — and wait for the developer. `off`: write the code yourself.
- `maxWorkers` — workers per wave (default 4).
- `workerModel` — the model you pass to each worker (default `sonnet`; on Cursor, `fast`). Always pass it explicitly: not every host honours the agent's own default.

## Split: contract first

Example: a page backed by a hook, a util and constants.

1. **The lead writes the contract.** The constants file in full, the shared types, and the hook's and util's exported signatures as stubs that throw `not implemented`. Every worker then compiles against real code, not prose.
2. **Wave 1, in parallel:**
   - the util worker: a pure module, with its tests;
   - the hook worker: builds against the util's signature;
   - the page worker: builds against the hook's signature, rendering with the stub.
3. **The lead integrates:** removes the stubs, wires the route, and runs the full checks.

A worker may depend on another unit's **signature**, never its **implementation**. When B can only be checked against A's real behaviour, run them as two waves, or give both to one worker.

Units share the main checkout — they compile against each other's stubs, and file ownership keeps them apart. Worktrees are for races and **single** delegates, and their briefs go inline in the prompt: handoff files are ignored by git, so a worktree does not have them.

The task's tier does not raise a unit's model; score each unit on its own.

## Handoff: write context once, read it many times

Output tokens cost more than input tokens. Never repeat shared context inside every prompt. Instead:

- First make sure `.gitignore` lists `.mulligan/handoffs/` (projects set up before 0.3.0 lack it); add the line if not.
- Write `.mulligan/handoffs/<task-slug>/shared.md` **once**: the decisions made so far, the contracts, the house patterns, and pitfalls found earlier in the session.
- Write one `<unit>.md` per worker from [references/handoff.md](references/handoff.md), containing only what that unit needs.
- The prompt to each worker is then three lines: *"Read `.mulligan/handoffs/<task>/shared.md` and `<unit>.md`, then build the unit. Report in the format at the end of your handoff."*

**Include** only what changes what the worker does:

- the decisions that constrain this unit, each with a one-line reason;
- the contract it implements and the contracts it consumes, pasted as signatures;
- the exact files to read, with line ranges for long files — *do not explore beyond this list; if you are blocked, stop and report*;
- one existing file to copy the house pattern from;
- pitfalls already hit in this session, e.g. a config quirk, or "type errors in files other workers are writing are expected";
- the principle skills this unit calls for beyond the Karpathy four;
- checks scoped to its own files: its own test file, or type-check output filtered to its paths. Behaviour that depends on another unit's stub stays UNPROVEN until integration.

**Leave out** the session history, the full spec, other units' details, and anything the worker cannot act on.

## Cost controls

- **At most `maxWorkers` per wave.** With more units, merge the small ones or run another wave.
- **Pick the model per worker.** `workerModel` by default; `haiku` for mechanical units (config, docs written from a spec, fixtures); the strongest model only when the unit alone scores tier 4–5 (*Models* in SKILL.md) or is security- or data-integrity-critical.
- **Run workers in the background.** Meanwhile, prepare the shared files they don't touch.
- **Fix with the same worker.** Continue it with `SendMessage`, since it still has its context. Allow one fix round, then fix it yourself.
- **Run checks once, at the right level.** Workers run checks scoped to their own files. The lead runs the full type-check, tests and build once, after integration.
- **Keep reports short:** at most 250 words plus the check-output lines that matter. Never read a worker's transcript.
- **Review once** (step 7). When you want an independent reviewer, use one `mulligan-reviewer` on `workerModel`, passed explicitly, and give it the changed-file list and `shared.md`, not the codebase. Use multi-model **interrogate** only for security or data-integrity work, or when the developer asks.
- **Report the spend.** List each worker's token usage (from its completion notice) in the final reply, so the developer can see what delegation cost.

## Integrate

After each wave:

1. Read each changed file's diff. Don't read the worker's transcript.
2. Replace the stubs and wire up the shared files.
3. Run the full checks. Fix integration problems yourself.
4. Review.

Delete `.mulligan/handoffs/<task-slug>/` once the developer accepts the work, unless they ask to keep it.

## Never

- Spawn a worker for work under the threshold.
- Let two workers write the same file.
- Let a worker spawn workers.
- Paste the shared context into each worker's prompt.
