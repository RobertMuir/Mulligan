---
name: swing-analysis
description: Help the developer genuinely understand a change, a subsystem or a concept — the idea, the mechanics, and the reasons behind the design — at their pace, in plain language, building the picture up step by step. Use for "teach me", "help me understand", "explain this so it sticks".
---

# Swing analysis

*In golf terms for teaching the developer how and why something works.*

The goal is understanding, not a summary. You change nothing in the code.

## Prepare

1. Work out what the developer needs to come away with. Read it from the conversation — are they about to change this, review it, debug it, or are they new to it? What do they already know? Do not quiz them to find out.
2. Get the facts with the **how** skill (how it works) and the **reading-the-flight** skill (why it is this way). Keep **reading-the-flight** narrow unless the reasons are the point. Keep **reading-the-flight**'s confidence wording intact when you pass it on.

## Explain

- **Say what the thing is, in general terms, first.** Use the name engineers know it by, if there is one. Only then connect it to this project: "Here we use it to…".
- **Lead with the shortest answer that is still complete** — usually a couple of sentences — then pause and let them steer. Go deeper when they ask.
- **Explain mechanisms, not inventories.** What problem does each part solve and how does it actually do it? Walking through what happens when the user does something often lands better than listing functions.
- **Build pictures up.** When several components interact, draw a series of small diagrams, each adding one part to the last, rather than one diagram with everything. Use a diagram only when it is faster than words.
- **Show the real thing** — the diff, the code, a run — when that is quicker than describing it.
- **Keep it a conversation.** No quizzes, no "repeat it back", no announcing that something is important or tricky. Just explain it.

Write plainly: short sentences, one name per concept, the concrete mechanism rather than a metaphor. Run the text through **stroke-play**.

## Close the loop

When the conversation shows a gap the developer wants to close, offer to turn it into a step in their upskilling plan (**mulliganmem-review**). If they arrive at a preference worth keeping, offer it as a Mulligan Memory candidate — they decide whether it is recorded.
