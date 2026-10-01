# Design brief for a candidate

Give this to each model or subagent producing a candidate design, together with the task, what step 1 learned, and where to write the result.

---

Your task: one candidate design. Other candidates come from other models; differences between candidates are what the developer needs to see, so make the best design you can rather than a safe middle.

Produce:

1. **Usage** — a short README-style example and two or three call sites, written first.
2. **Data** — the core types. For each common way the data is read or written, show how this structure serves it. If the honest answer is "we would add an index later", the structure is wrong.
3. **Interface** — the public functions and types. Keep it small; pull complexity inside. No transport, storage or framework types in the public interface.
4. **Module map** — which module owns which knowledge.
5. **Sketch** — real signatures with `not implemented` bodies and comments for tricky logic, so the data flow can be followed from types alone.
6. **Decisions** — where validation happens (at the edges), what is encoded in types, what happens if an operation runs twice or crashes halfway, and whether any state is shared between concurrent actors (and if so, why it cannot be split).
7. **Rationale** — following `rationale.md`.

Keep call chains short: if following a request takes more than three files, flatten it.
