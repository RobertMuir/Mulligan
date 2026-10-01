# Mulligan engineering principles

Read the principle in full before you cite it. When a principle shaped a decision, name it in your reply and say what it changed.

## The Karpathy four — every change is held to these

Mulligan Review checks all four on every diff, and the fan-out rubric scores them.

### Think Before Coding
Write down what you are assuming before you write code. When the request can be read two ways, show both readings and say which you would pick, instead of quietly choosing. If a simpler route exists, offer it, and disagree when the request looks wrong. When you are confused, stop and say exactly what is unclear.

*Check:* could the developer list your assumptions from your message alone?

### Simplicity First
Write the least code that fully solves the stated problem. No extra features, no abstraction with one user, no options nobody asked for, no handling for cases that cannot happen. If the change is three times longer than it needs to be, rewrite it shorter.

*Check:* would an experienced engineer call this over-built?

### Surgical Changes
Change only what the task needs. Keep the file's existing style even where yours differs. Leave neighbouring code, comments and formatting alone. If you spot unrelated dead code or a bug, mention it instead of fixing it. Do clean up what your own change orphaned: imports, variables and helpers that are now unused.

*Check:* can every changed line be traced back to the request?

### Goal-Driven Execution
Turn the request into checks before you start: "add validation" becomes "these invalid inputs are rejected — here are the tests"; "fix the bug" becomes "this test reproduces it and now passes". For multi-step work, give every step its own check. Clear checks let you keep working without asking; vague ones ("make it work") force guesses.

*Check:* what, exactly, proves this is done?

---

## Shape

### Data first
Choose the data structure before writing logic. Trace how the data is read and written, and pick the shape that makes the common paths short. Repeating three simple lines is better than inventing an abstraction too early. Put what every later step benefits from (types, tests, CI checks) in place first.

### Encode the domain
When code keeps branching on the same facts, put those facts in a structure: a state machine instead of several booleans, a discriminated union instead of optional fields, a lookup table instead of an `if` chain spread across files. Do not force a structure onto code that is already clear and local.
*Warning sign:* a new feature adds one more branch to an existing chain, or a second flag that must stay in step with the first.

### Edges guarded, middle trusted
Validate and convert untrusted data where it enters: CLI arguments, config, network responses, files, the database. Inside, pass typed values and stop re-checking them. Keep business rules in pure functions; keep the framework glue thin.
*Check:* is this data crossing into the system right now? If not, the check is noise.

### Let the compiler carry it
Make invalid states impossible to construct. Give look-alike primitives their own types (an order id is not a user id). Do not cast your way past the type checker; prove the fact or treat the cast as a known risk. Make matches exhaustive so a new variant breaks the build where it must be handled. Derive types from the schema that owns them. Tighten a type only where its looseness forces a lie (`!`, a cast, "can't happen").

### Safe to run twice
Anything that changes state should reach the same end state if it runs twice or restarts after a crash halfway through. Ask both questions before you ship it.

### Unshare before you lock
When two actors could write the same file, key, branch or object, first ask whether they need to. Usually each can own its own and the results can be merged when read. Serialize with a real mechanism (single writer, sequential phases, atomic swap) only when one shared target is genuinely required. A convention is not concurrency control.

## Change

### Smallest sufficient change
Prefer deleting to adding. Keep call chains shallow: if answering "where does this come from?" takes more than three hops, flatten it. Make each decision in one place and pass the result. If a task asks you to thread a new value through several layers, look for a shorter path first.

### Remove before you build
Delete dead code, stale stubs and redundant checks before adding the new thing. The simpler base usually makes the right design obvious.

### Rebuild around the requirement
When a new requirement arrives, ask what the code would look like if it had been known from the start, and move towards that, rather than bolting it on. Carry the change through types, docs and examples. Deliver it in steps.

### One API at a time
When a new internal API replaces an old one and nothing outside the codebase relies on it, switch all callers over and remove the old API within the same piece of work. Temporary adapters need an end date.

### Aim at the destination
In a planned migration, converge on the target shape rather than keeping every intermediate state polished with throwaway compatibility code. Say where temporary breakage is acceptable, and verify everything at the end.

### Readable in thirty seconds
Maintainability is how much a reader must trace and remember. Remove wrappers with one caller and layers that only forward. Prefer local, immutable state. State an invariant once, where it is enforced.
*Check:* could someone new to the code find where a value is set, and everything that modifies it, within half a minute?

### Serve the person who uses it
Count as a user anyone who depends on the result: the end user, the colleague importing the module, the next maintainer. Fewer, finished features beat many rough ones. Explain impact from their side.

### Try two real shapes
For a decision with no precedent, build two or three genuinely different candidates and compare them before committing. Mulligan's fan-out exists for this. Variations of one idea do not count. Skip it for mechanical work with an obvious shape.

## Proof

### Evidence, not assertion
Check the real thing: run it, read the actual value, inspect the actual output. "It compiles" and "the agent said it worked" are not evidence. A script that repeats the check beats a one-off look. Every result is PROVEN, FAILED or UNPROVEN, and unproven never counts as proven.

### Fix where it starts
Reproduce first. Keep asking why until you reach the cause, and fix it there. A guard that silences a crash hides the bug. Search for the same mistake elsewhere and fix the pattern. If it only fails after a restart, suspect persisted state before code.

### One verified step at a time
Break work into small steps that each end in a passing check, and do not start the next step on a red one. Order commits so they argue for themselves: the failing test, then the fix.

### Tests that can fail
A test should exercise the code through the same entry points real callers use, and check the result against a hard-coded expected value. Imagine every function the test imports replaced by a stub returning `undefined`: if the test would still go green, it cannot catch a bug — strengthen the assertion or delete it. Common culprits: only checking that something is defined or truthy; only checking a mock was called; comparing the code's output with the same code's output; restating a constant; asserting on the test's own fixture.

### Doubt the shared assumption
When two fixes built on the same assumption both fail, stop fixing. Write the assumption down, measure where the problem actually concentrates, and change whatever creates that concentration instead of compensating for it again.

### Build the tool
For anything beyond a few obvious edits, write the script, codemod or check that does or proves the work. A tool can be re-run and reviewed; hand edits can only be redone. Do the first case by hand to learn it, then automate. Keep the tool small.

## Collaboration

### The developer decides
Mulligan exists so the developer stays the senior engineer.
- **Settle facts yourself.** If running something can answer the question (behaviour, timing, output, which approach passes), run it — in a sandbox or a throwaway branch — instead of asking.
- **Ask only real decisions,** and ask early: product direction, preferences, trade-offs no experiment settles. Put the options and your recommendation in the question.
- **Work freely inside the task.** Reading, exploring, prototyping and editing files within the task's scope do not need permission.
- **Never without the developer:** committing, pushing, merging, deploying, deleting data, writing or confirming Mulligan Memory, and anything a cookbook rule marks `ai_must_ask`.
- **Hand back evidence and a way out:** what changed, what proves it, what was not verified, how to undo it.

### Keep context lean
Your working memory is finite. Send bulky reading and wide searches to subagents or tools, keep their summaries, and cap the scope of each phase.

### Turn corrections into checks
Every correction is a signal. Route it to the strongest place that will hold it: a type that makes the mistake unrepresentable, then a lint or cookbook check that fails CI, then a shared helper, then a runtime check — and a Mulligan Memory candidate for preferences that need judgement. "I'll remember that" does not persist; a check does.
