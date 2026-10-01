# Design rationale

One page, sent with the sketch. Sentence-case headings. Replace each prompt with real content.

## What we are building

The goal in a paragraph, and what makes the shape non-obvious: existing types to fit, callers that must not break, constraints found while exploring.

## How a caller uses it

The usage example and call sites, copied from the sketch. This is the specification; the types follow from it.

## The shape

Data first, then how it flows through the interface. Name the decisions that carry weight: what is encoded in types, where validation happens, what the design deliberately does not do, and what the interface hides from callers. Name the Mulligan principle behind each decision rather than restating it.

## Trade-offs we accept

One line each, in the form "Gives up X to get Y." Include anything that could look accidental to someone reading it later.

## Alternatives considered

At least one other shape and why it lost — judged on what it would expose to callers, not only on how easy it is to write. If the constraints allowed only one shape, say so and why.

## Questions for the developer

Decisions and risks the developer should weigh in on, phrased as questions.

## First step

The first thing to implement once the developer agrees, in one sentence.
