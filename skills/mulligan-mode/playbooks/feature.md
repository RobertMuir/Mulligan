# Feature

New or changed behaviour, built on a named data shape.

1. **Understand the area.** Read the code it touches in one batch; use **how** only for a large or unfamiliar subsystem. Check Mulligan Memory and the cookbook for rules that apply here.
2. **Name the data shape** and the structure that holds it (Data first, Encode the domain). Write the caller's usage before the internals.
3. **Define done** as checks: the tests or commands that will prove it, and how a user will see it work.
4. **Design.** If the change crosses a module boundary and has more than one reasonable shape, run **architect**; when the codebase already has a pattern for this kind of change, follow it instead. If the shape is genuinely contested — no precedent, or reasonable engineers would build it differently — race it with **attacking-the-pin** and let the rubric and the evidence rank the candidates.
5. **Plan the work in parallel only along real seams.** Independent files or services can proceed in parallel; anything writing the same place is done in sequence (Unshare before you lock). Note anything that must happen first. When two or more units are each worth a worker, write the shared contracts first and hand each unit to a `mulligan-agent` ([delegation.md](../delegation.md)).
6. **Implement** what you kept, and integrate what the workers built: the smallest sufficient change, one verified step at a time.
7. **Verify** on the real surface.
8. **Review** with **mulligan-review**. If the design is contested, add **interrogate**.

**Reply:** what was built and for whom, the choices made and why (a table when there were alternatives), how it was verified, what was not verified, and the decisions waiting on the developer.
