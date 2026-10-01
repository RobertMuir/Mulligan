/**
 * Mulligan Bot design tokens (spec §42). The interface is primarily white /
 * light neutral; Mulligan Green identifies navigation, buttons, status,
 * active states and the mascot. It is never used as a full-screen fill.
 */
export const BRAND = {
  green: '#076652',
  white: '#FFFFFF',
  /** Very limited dark detailing — outlines, eyes, text on white. */
  ink: '#0B3B31',
  /** Dimples and subtle surfaces. */
  mist: '#E6EEEC',
  /** Cheeks and soft highlights. */
  mint: '#CFE5DF',
} as const;

export const CATCHPHRASE = 'Take a Mulligan.';

/** Personality: curious, humble, methodical, slightly playful, comfortable with uncertainty (spec §41). */
export const PHRASES = {
  verify: "Let's verify that.",
  doubt: "I'm not convinced yet.",
  alternative: 'We have another approach.',
  explain: "Here's what changed and why.",
  handover: 'You decide.',
  tagline: "If at first you don't succeed...",
} as const;
