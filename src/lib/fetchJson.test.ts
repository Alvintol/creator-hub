import { describe, expect, it, vi } from 'vitest';
import { fetchJson } from './fetchJson';

describe('fetchJson', () => {
  it('throws a helpful error when response is HTML', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      status: 200,
      text: async () => '<!doctype html><html><body>...</body></html>',
    } as any)));

    await expect(fetchJson('/api/health')).rejects.toThrow('/non-JSON/i');
  });
});