# Security brief

**Concern.** {vulnerability class or finding} in {component}

**Trust boundary.** Untrusted input enters at: {request, file, message, env} and reaches: {sink: SQL, shell, eval, HTML, filesystem, authorisation decision}

**Threat.** Who could exploit it, how, and what they gain.

**Do.**
1. Trace the input path from entry to sink and show it.
2. Fix at the boundary: validate or parse there; use safe APIs (parameterised queries, argument arrays, escaping, allow-lists).
3. Add a test that attempts the attack and is rejected.
4. Search for the same pattern elsewhere.

**Never.** Commit secrets, weaken authentication to make a test pass, or log sensitive data. Ask before changing anything marked `ai_must_ask` (auth, payments, migrations, …).

**Success checks.** The attack test is rejected · existing auth and permission tests pass · no secrets in the diff (Mulligan Review security section).

**Report.** The path, the fix, the test, other instances found, and residual risk.
