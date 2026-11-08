import { describe, expect, it } from 'vitest';
import { parseDate } from './parse.js';

describe('parseDate', () => {
  it.each([
    ['03/11/26', '2026-11-03'],
    ['3/1/2026', '2026-01-03'],
    ['03-11-2026', '2026-11-03'],
    ['2026-11-03T00:00:00', '2026-11-03'],
  ])('%s → %s', (input, out) => expect(parseDate(input)).toBe(out));

  it('returns null for garbage', () => expect(parseDate('hoy')).toBeNull());
});
