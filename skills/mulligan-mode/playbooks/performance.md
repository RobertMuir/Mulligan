# Performance

Every change is tied to a measurement. Reading code is not measuring.

1. **Measure the baseline** on the real surface: a profile, a trace, a timed script. Save it.
2. **Find where the time goes** in the measurement, then use **how** to understand that path. Do not claim a limit you have not measured.
3. **Form hypotheses from what the trace shows.** Useful directions, each only when the trace points at it:
   - **Remove it** — work nobody consumes, or a path that is always off for this user.
   - **Do less per item** — split, prune or index so each step touches less.
   - **Reuse a result** — cache, and name what invalidates it.
   - **Batch** — many small calls each paying a fixed cost.
   - **Defer** — work done eagerly that is not needed yet.
   - **Move it off the critical path** — do it where nobody is waiting.
4. **Change one thing, measure again.** Keep it only if the number moved. One verified step at a time.
5. **Compare like with like:** same machine, same data, same method. Inconclusive is reported as inconclusive.

**Reply:** baseline, result, the difference, how it was measured, and where the measurements are saved.
