/**
 * Testes extremos para osmService.ts — endpoints vazios.
 *
 * Cobre linha 58 de osmService.ts:
 *   throw lastError || new Error('All Overpass endpoints failed');
 * O lado direito do || só é atingido quando OVERPASS_API_ENDPOINTS está vazio
 * (lastError continua null após o for loop não iterar).
 *
 * Este arquivo tem seu próprio mock de módulo para isolar o comportamento.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock constants BEFORE importing osmService — empty endpoints list
vi.mock('../../src/constants', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/constants')>();
  return {
    ...original,
    OVERPASS_API_ENDPOINTS: []
  };
});

vi.mock('../../src/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

global.fetch = vi.fn();

import { fetchOsmData } from '../../src/services/osmService';

describe('osmService — empty OVERPASS_API_ENDPOINTS', () => {
  it('throws "All Overpass endpoints failed" when endpoint list is empty (covers || right side, line 58)', async () => {
    await expect(fetchOsmData(-22.15018, -42.92185, 100))
      .rejects
      .toThrow('All Overpass endpoints failed');

    // fetch should never have been called (empty endpoints list → loop never runs)
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
