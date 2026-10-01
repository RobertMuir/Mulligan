# Design checks

Run every candidate design through these. A design that fails a check gets reworked or dropped.

## Is the interface worth learning?

Compare what the interface hides with how big it is. A good module offers a small surface over substantial behaviour. Warning signs:

- a caller needs several calls in the right order to do one thing;
- its settings leak how it works inside (pipeline stages, algorithm choices);
- understanding the interface still requires reading the implementation.

A long call chain is not the same as a deep module: the first spreads understanding across layers, the second concentrates it behind one surface.

## Does a decision live in exactly one place?

If a format, policy or protocol detail appears in several modules, changing it means coordinated edits everywhere. Keep storage formats, framework objects and wire types private; convert to domain types at the edge.

## Is it organised by knowledge, not by time?

Modules named after steps (load, validate, transform, save) tend to repeat the same representation and rules at every step. Group code by what it knows and protects. Code that runs at different times can still belong together.

## Does every layer earn its place?

A function or class that only forwards arguments to another with the same shape adds a hop without hiding anything. Remove it, or give it real responsibility (policy, adaptation, a genuinely different abstraction).

## Simplicity and scope

- Is anything here for a requirement nobody stated? (Simplicity First)
- Does the design touch more of the existing system than the task needs? (Surgical Changes)
- Can the design be verified — is it obvious what tests would prove it? (Goal-Driven Execution)
