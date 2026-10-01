import { describe, expect, it } from 'vitest';
import { parseFlags } from '../src/terminal/commands/types.js';

describe('parseFlags', () => {
  it('treats unknown flags as switches, so they never swallow the task text', () => {
    expect(parseFlags('--single add a settings toggle')).toEqual({ flags: { single: true }, multi: {}, rest: 'add a settings toggle' });
    expect(parseFlags('--no-verify fix the cache', { numbers: ['n'] }).rest).toBe('fix the cache');
  });

  it('reads values only for flags declared to take them', () => {
    const parsed = parseFlags('--base develop --scope "src/a/**" --scope src/b --all review it', { values: ['base', 'scope'] });
    expect(parsed.flags).toEqual({ base: 'develop', scope: 'src/b', all: true });
    expect(parsed.multi.scope).toEqual(['src/a/**', 'src/b']);
    expect(parsed.rest).toBe('review it');
  });

  it('reads numeric flags only when a number follows', () => {
    expect(parseFlags('--fanout 4 build login', { numbers: ['fanout'] }).flags).toEqual({ fanout: '4' });
    expect(parseFlags('--fanout build login', { numbers: ['fanout'] })).toMatchObject({ flags: { fanout: true }, rest: 'build login' });
  });

  it('accepts --flag=value for any flag', () => {
    expect(parseFlags('--n=5 task').flags).toEqual({ n: '5' });
  });
});
