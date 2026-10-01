---
name: stroke-play
description: Remove the tells of machine-written prose — padding, inflated vocabulary, vague claims, formatting habits and chatbot residue — from any text before it ships, keeping the meaning and the intended tone. Apply to every reply, document, PR description and commit message.
---

# Stroke-play

*In golf terms for cutting machine-written padding from prose, stroke by stroke.*

Read the text, find the patterns below, and rewrite them. Keep the meaning. Keep the tone the text is meant to have.

## Padding

- **Throat-clearing.** "It's worth noting that", "It is important to remember", "As mentioned above" — delete and say the thing.
- **Wordy connectors.** "In order to" → "to". "Due to the fact that" → "because". "At this point in time" → "now". "In the event that" → "if".
- **Tail clauses that add a feeling, not a fact.** "…, ensuring a seamless experience", "…, highlighting its flexibility". Delete them, or replace with the actual effect.
- **Empty endings.** "This sets us up for success." "The possibilities are endless." End on a fact or a next step.

## Inflation

- **Grand words for plain ones.** utilise, leverage, facilitate, delve, robust, seamless, crucial, pivotal, comprehensive, cutting-edge, empower, elevate, landscape, realm, journey, tapestry. Use the plain word, or the number.
- **Dressed-up "is".** "serves as", "stands as", "functions as", "boasts". Write "is" or "has".
- **Contrast framing.** "It's not just X — it's Y." State Y.
- **Forced threes.** Lists of three because three sounds finished. Use however many there really are.
- **Rotating synonyms.** Calling one thing "the cache", "the store" and "the buffer" in one paragraph. Pick one name and keep it.

## Vague claims

- **Unnamed authorities.** "Experts agree", "studies show", "it is widely known". Name the source or cut the claim.
- **Feelings instead of facts.** "The API feels fast" → "p95 latency is 40 ms". "Painless setup" → "`npx create-app` writes a working project in one command". A sentence that would fit unchanged into any project's README tells the reader nothing about this project.
- **Adverb props.** "significantly improves", "runs quickly". Give the measurement, or a stronger verb.
- **Stacked hedges.** "could potentially perhaps" → "may". One hedge, where it is true.

## Jargon dressed as precision

Abstract nouns used as metaphors: substrate, primitive, surface (for an API), vector (for a way), wedge, lever, flywheel, north star, paradigm, synergy, ecosystem, unlock. Write the concrete word — "base", "building block", "the functions you can call", "way", "add".

## Formatting habits

- **Dashes as all-purpose glue.** Prefer full stops and commas; a dash should be rare.
- **Colons mid-sentence** to set up a reveal. A colon is for introducing a list or an example.
- **Bold everywhere.** Bold is for the one thing the reader must not miss.
- **Label-and-colon bullets that restate themselves.** "**Speed:** The speed improved." Write it as a sentence. A bold lead-in followed by genuinely new information is fine.
- **Title Case Headings.** Use sentence case.
- **Decorative emoji** in headings and bullets.
- **Curly quotes** in technical text. Use straight quotes.

## Chatbot residue

"Great question!", "Absolutely!", "Hope that's useful!", "Happy to help further", "Feel free to reach out", "You're so right". Delete them. Answer directly. Agree only when you do, and say why.

## Over-correction

Cutting words can go too far. Do not drop articles and verbs into telegraph style ("Upload fails → retry x3, alert"). Write full sentences: "If the upload fails, the client retries three times and then raises an alert." Split a sentence the reader has to read twice; do not compress it.

## Final check

For each sentence, ask what the reader can now do, or now knows, because of it. If nothing, cut it.
