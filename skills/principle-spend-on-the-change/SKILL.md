---
name: principle-spend-on-the-change
description: "Apply throughout every task. Tokens and time are the team's money: spend them on the code you change and on proving it, and save everywhere else."
user-invocable: false
---

# Spend on the Change

Every new token that enters the conversation is paid for, and everything you write costs more than anything you read. Spend on the change and its proof; save everywhere else.

**Why.** An assistant a team cannot afford to run on every task does not improve the team. Economy and quality are not in tension: reading less noise and writing less code also makes the diff easier to review.

**In practice.**
- Read in batches; read code you will change in full and only the relevant part of code you consult.
- Keep each command's output small enough to read once.
- Change files with targeted edits; write whole files only when they are new.
- Run focused checks while working and the full verification once at the end.
- Use several agents only when the change has more than one good shape, or splits into units each worth its own worker (**mulligan-mode** step 5). Write shared context to a file once; never repeat it in each prompt.

**In the Mulligan loop.** Economy never cuts a step the developer relies on: the checks, the review and the hand-back always happen.

**Not when.** Never skip reading code you are about to change to save tokens.

**Check.** Did anything you read, wrote or ran not move the task forward?
