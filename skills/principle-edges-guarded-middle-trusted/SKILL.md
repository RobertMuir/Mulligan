---
name: principle-edges-guarded-middle-trusted
description: "Apply when wiring validation, parsing, error handling or framework glue. Validate untrusted data where it enters, pass typed values inside, and keep business rules pure."
user-invocable: false
---

# Edges Guarded, Middle Trusted

Validate and convert untrusted data where it enters the system — requests, config, files, storage, other services. Inside, pass typed values and stop re-checking them. Keep business rules in plain functions and the framework glue thin.

**Why.** One strong boundary is easier to audit than a hundred scattered checks, and a check in the middle hides where the data really came from.

**In practice.**
- Parse with a schema at the boundary; never assert a type onto untrusted data.
- Enforce access rules in the layer every entry point goes through.
- Error responses carry a safe message; details go to the server log.

**In the Mulligan loop.** Boundary rules you had to infer (who may read or write what) are listed for the developer to confirm.

**Not when.** Data already parsed and typed does not need validating again.

**Check.** Is this data crossing into the system right now? If not, the check is noise.
