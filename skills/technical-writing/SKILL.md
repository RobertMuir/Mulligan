---
name: technical-writing
description: Write documentation, READMEs, design docs, PR descriptions and commit messages that an engineer at the end of a long day can act on after one reading — the right type of document, sentences aimed at the reader, one idea at a time, and nothing that can be read two ways. Use for /technical-writing or any writing that ships with the code.
---

# Technical writing

The test is simple: could someone who is tired and busy act on this after reading it once? Four questions get you there — what kind of document is this, who is the sentence speaking to, how much is packed into each sentence, and could anything be read two ways?

Three rules come before everything else:

- **Every word does a job.** If the sentence works without a word, remove it.
- **Use the everyday word.** "Use", not "utilise". "Help", not "facilitate". A long word must earn its length with precision.
- **The rules serve the reader.** When obeying a rule produces a clumsier sentence, find a different fix.

Use the codebase's real names: the actual function, file, flag and command, not a description of them.

## 1. Choose the document type

Each document does one job. Pick it by asking whether the reader wants to *do* something or *understand* something, and whether they are *learning* or *working*:

| | Learning | Working |
|---|---|---|
| **Doing** | Tutorial — you lead a newcomer to a working result, step by visible step | How-to — steps to a goal for someone who knows the basics |
| **Understanding** | Explanation — the why: context, trade-offs, history, alternatives | Reference — facts to look up: options, limits, errors |

(This is the Diátaxis framework.) Do not mix types in one document: link instead. Tutorials show the expected output after each step. How-tos are named after the task ("Rotate the signing key"). Reference is complete, dry and structured like the thing it describes, and generated from code where possible. Explanation is the only place for opinion.

## 2. Write to the reader

- Speak to the reader directly ("you") and describe what happens now. Keep "will" for things that genuinely happen later.
- Name who acts: "the parser rejects the file", not "the file is rejected".
- Give instructions as commands: "Run `pnpm test`." Not "the tests should be run".
- Put the condition first: "To reset the cache, delete `.cache/`."
- Common case first; exceptions after.
- No "simply", "just", "easy" or "quickly" in instructions. If it were easy, the reader would not be reading.
- Headings say the point ("Pick the type first"), in sentence case. Task headings are verb phrases.
- Numbered lists for sequences; bullets otherwise. Introduce a list with a full sentence.
- Code in code font. Link text names the destination, never "click here".

## 3. One idea at a time

- One instruction per sentence; one idea per sentence elsewhere.
- As a rough limit, keep instructions under twenty words and other sentences under twenty-five — but a long sentence carrying one idea and its condition can stay.
- Put warnings before the step they protect.
- Keep the small words ("the", "a", "that") that make a sentence parse one way.
- One word per action, used consistently. If you write "start", do not later write "launch" for the same thing.

## 4. Leave nothing ambiguous

- Put "only" and "not" right beside the word they qualify.
- Break up noun stacks: "the job that removes expired sessions", not "the expired session cleanup job".
- Each "it", "this" or "they" must have exactly one possible referent; if there is doubt, use the noun again.
- Do not drop verbs from parallel clauses.
- No slashes for "or" ("a, b, or both"); no "(s)" plurals.
- Call each thing by one name throughout.
- Avoid idioms and metaphors; translators, non-native readers and models all read literal text best.

## Vary the rhythm

Text that follows every rule can still read as machine-made: every sentence the same length, no view, nothing specific. Mix short and longer sentences on purpose. In explanations, say what you conclude from the trade-offs. Prefer the specific ("renaming a column fails the build") to the vague ("schema changes can cause issues").

## Pull requests and commits

- A PR description is a briefing a reviewer reads in a minute. Follow the sections your golden PRs use (`.mulligan/golden-pr/principles.yaml`) — usually the problem, the change, how it was tested, risks, and rollback. State assumptions and success criteria (Think Before Coding, Goal-Driven Execution). Link logs and tables instead of pasting them.
- A commit message says what changed and why in the subject, with detail in the body.

Run every document through **stroke-play**.
