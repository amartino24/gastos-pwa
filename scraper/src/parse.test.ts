import { describe, expect, it } from 'vitest';
import { parseArAmount, parseDate } from './parse.js';

describe('parseDate', () => {
  it.each([
    ['03/11/26', '2026-11-03'],
    ['3/1/2026', '2026-01-03'],
    ['03-11-2026', '2026-11-03'],
    ['2026-11-03T00:00:00', '2026-11-03'],
  ])('%s → %s', (input, out) => expect(parseDate(input)).toBe(out));

  it('returns null for garbage', () => expect(parseDate('hoy')).toBeNull());
});

describe('parseArAmount', () => {
  it.each([
    ['99.999,99', 99999.99],
    ['$ 1.234.567,89', 1234567.89],
    ['-1.234,5', -1234.5],
    ['24.219', 24219],
    [12.5, 12.5],
    [null, 0],
  ])('%s → %s', (input, out) => expect(parseArAmount(input)).toBe(out));
});
