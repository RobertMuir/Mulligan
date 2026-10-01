# Security hardening

Make code safe for wider exposure, or review it for vulnerabilities. The checklist follows the OWASP API Security Top 10 (2023). Every finding is proven before it is fixed, and legitimate use must keep working.

1. **Inventory.** List the entry points in scope and trace each one to everything it reads and writes: handler → service → helpers → storage. Read them in one batch, together with the existing permission model (roles, ownership, tenancy) and the tests that show legitimate use.
2. **Threat-model each entry point** against the checklist and write one line per finding:
   - **Object-level access (API1).** Can a caller reach records that belong to another user, tenant or team by changing an id or a search term? Every read, list, search and write checks the caller against the record.
   - **Authentication (API2).** Is the caller's identity established before anything else, and never taken from the request body?
   - **Property-level access (API3).** Does the response include fields the caller may not see? Can the request body set fields the client should never control — ids, ownership, tenancy, server-maintained fields — or anything outside an explicit allowlist (mass assignment)?
   - **Function-level access (API5).** Is each operation limited to the roles that need it?
   - **Resource consumption (API4).** Are sizes, page lengths and expensive inputs bounded?
   - **Untrusted input.** Is every input's type, size and format validated where it enters? Does any untrusted value reach a query, regular expression, file path, shell, object key or recursive merge without escaping or an allowlist?
   - **Errors and misconfiguration (API8).** Do error responses leak internals (stack traces, messages, paths)? Does "not allowed to see" look the same as "does not exist", so record ids cannot be probed?
   - **Unsafe consumption (API10).** Is data from other services or files validated like user input?
3. **Prove each finding** before fixing it: a failing test through the public entry point, or a probe against the original code. A finding you cannot demonstrate is reported as suspected, not fixed.
4. **Fix where every caller passes.** Enforce access in the layer all entry points go through (usually the service), reusing the codebase's existing permission helpers and patterns. Validate at the boundary with an allowlist schema. Remove unsafe helpers your fix leaves unused.
5. **Keep legitimate use working.** For every role the code serves, a test shows its allowed path still works.
6. **Verify** with the full verification commands and the original tests unchanged.

**Reply:** a findings table — finding · OWASP category · before (evidence) · fix · after (evidence) — then what was deferred or only suspected, and the access rules you assumed (who may read and write what) for the developer to confirm.
