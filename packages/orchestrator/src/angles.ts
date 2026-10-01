/**
 * Different angles on the same problem. Fan-out is only worth paying for if
 * the candidates genuinely differ, so each one gets a distinct brief rather
 * than the same prompt N times.
 */
export interface Angle {
  id: string;
  name: string;
  brief: string;
}

export const DEFAULT_ANGLES: Angle[] = [
  {
    id: 'smallest',
    name: 'Smallest sufficient change',
    brief: 'Solve the task with the least new code that fully meets it. Add no layers, options or helpers the task does not need.',
  },
  {
    id: 'failure-first',
    name: 'Failure first',
    brief: 'Start from how this breaks: bad input, partial failure, retries, empty and huge cases. Handle the failures the task implies, and prove them with tests.',
  },
  {
    id: 'codebase-native',
    name: 'Codebase native',
    brief: 'Follow the patterns this codebase already uses for this kind of change, even where you would personally choose differently. Reuse existing helpers.',
  },
  {
    id: 'test-first',
    name: 'Test first',
    brief: 'Write the tests that define "done" first, then the smallest implementation that makes them pass. Include both in your answer.',
  },
  {
    id: 'rebuild',
    name: 'Rebuild around the requirement',
    brief: 'Treat the requirement as if it had existed from day one. Reshape the affected code so it reads naturally, rather than bolting the change on.',
  },
  {
    id: 'data-first',
    name: 'Data shape first',
    brief: 'Decide the data structure that makes the rest obvious — a type, a table, a state machine — then write the code that follows from it.',
  },
];

/** The first `count` angles, cycling when more candidates than angles are asked for. */
export function pickAngles(count: number): Angle[] {
  return Array.from({ length: count }, (_, i) => DEFAULT_ANGLES[i % DEFAULT_ANGLES.length] ?? []).flat();
}
