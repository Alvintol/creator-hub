import { describe, expect, it } from 'vitest';
import { normalizeTwitchLogin } from '../twitch';

describe('normalizeTwitchLogin', () => {
  it('lowercase and trims', () => {
    expect(normalizeTwitchLogin('  ALVIN  ')).toBe('alvin');
  })

  it('removes leading @', () => {
    expect(normalizeTwitchLogin('@alvin')).toBe('alvin');
  });
});