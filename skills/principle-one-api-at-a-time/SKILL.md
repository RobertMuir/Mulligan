---
name: principle-one-api-at-a-time
description: "Apply when introducing an internal API that replaces an old one. Move every caller and delete the old API in the same piece of work."
user-invocable: false
---

# One API at a Time

When a new internal API replaces an old one and nothing outside the codebase relies on it, switch every caller over and delete the old API in the same change.

**Why.** Two ways to do one thing doubles what every reader must learn, and "temporary" adapters outlive their authors.

**In practice.**
- Find every caller first (including strings, docs and tests a search may miss).
- Migrate and delete together; an adapter that must stay needs an end date.

**In the Mulligan loop.** If external users rely on the old API, removing it is the developer's decision.

**Not when.** Public APIs with outside consumers follow their deprecation policy instead.

**Check.** After this change, is there exactly one way to do it?
