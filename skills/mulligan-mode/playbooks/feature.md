# Feature

New or changed behaviour, built on a named data shape.

1. **Understand the area** with **how**. Check Mulligan Memory and the cookbook for rules that apply here.
2. **Name the data shape** and the structure that holds it (Data first, Encode the domain). Write the caller's usage before the internals.
3. **Define done** as checks: the tests or commands that will prove it, and how a user will see it work.
4. **Design.** If the change crosses a function boundary or has more than one reasonable shape, run **architect**. If the shape is genuinely contested or the task is hard, fan it out with **attacking-the-pin** and let the rubric and the evidence rank the candidates.
5. **Plan the work in parallel only along real seams.** Independent files or services can proceed in parallel; anything writing the same place is done in sequence (Unshare before you lock). Note anything that must happen first.
6. **Implement** the smallest sufficient change, one verified step at a time.
7. **Verify** on the real surface.
8. **Review** with **mulligan-review**. If the design is contested, add **interrogate**.

**Reply:** what was built and for whom, the choices made and why (a table when there were alternatives), how it was verified, what was not verified, and the decisions waiting on the developer.
