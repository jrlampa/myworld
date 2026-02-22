/**
 * Testes unitários para o hook useOsmEngine.
 *
 * Cobre: runAnalysis (sucesso, sem dados, erro), clearData, setOsmData,
 * estado inicial, progressão de estados.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOsmEngine } from '../../src/hooks/useOsmEngine';

// ─── Mocks de serviços externos ───────────────────────────────────────────────

vi.mock('../../src/services/osmService', () => ({
  fetchOsmData: vi.fn(),
}));

vi.mock('../../src/services/elevationService', () => ({
  fetchElevationGrid: vi.fn(),
}));

vi.mock('../../src/services/dxfService', () => ({
  calculateStats: vi.fn(),
}));

vi.mock('../../src/services/geminiService', () => ({
  analyzeArea: vi.fn(),
}));

import { fetchOsmData } from '../../src/services/osmService';
import { fetchElevationGrid } from '../../src/services/elevationService';
import { calculateStats } from '../../src/services/dxfService';
import { analyzeArea } from '../../src/services/geminiService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CENTER = { lat: -22.15018, lng: -42.92185, label: 'Muriaé/MG' };
const RADIUS = 500;

const MOCK_OSM_ELEMENTS = [
  { type: 'node', id: 1, lat: -22.15, lon: -42.92, tags: { building: 'yes' } },
  { type: 'way', id: 2, nodes: [1, 2], tags: { highway: 'residential' } },
];

const MOCK_TERRAIN = {
  grid: [[10, 11], [12, 13]],
  bounds: { minLat: -22.16, maxLat: -22.14, minLng: -42.93, maxLng: -42.91 },
};

const MOCK_STATS = {
  buildings: 1,
  roads: 1,
  totalElements: 2,
  area_km2: 0.79,
};

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('useOsmEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('estado inicial', () => {
    it('deve inicializar com isProcessing=false e sem dados', () => {
      const { result } = renderHook(() => useOsmEngine());

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.progressValue).toBe(0);
      expect(result.current.statusMessage).toBe('');
      expect(result.current.osmData).toBeNull();
      expect(result.current.terrainData).toBeNull();
      expect(result.current.stats).toBeNull();
      expect(result.current.analysisText).toBe('');
      expect(result.current.error).toBeNull();
    });
  });

  describe('runAnalysis — fluxo de sucesso', () => {
    it('deve completar com sucesso e retornar true (com AI desabilitada)', async () => {
      (fetchOsmData as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_OSM_ELEMENTS);
      (fetchElevationGrid as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TERRAIN);
      (calculateStats as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS);

      const { result } = renderHook(() => useOsmEngine());

      let returnValue: boolean | undefined;
      await act(async () => {
        returnValue = await result.current.runAnalysis(CENTER, RADIUS, false);
      });

      // Avança o setTimeout de 800ms que limpa isProcessing
      act(() => { vi.advanceTimersByTime(800); });

      expect(returnValue).toBe(true);
      expect(result.current.osmData).toEqual(MOCK_OSM_ELEMENTS);
      expect(result.current.terrainData).toEqual(MOCK_TERRAIN);
      expect(result.current.stats).toEqual(MOCK_STATS);
      expect(result.current.error).toBeNull();
      expect(result.current.isProcessing).toBe(false);
    });

    it('deve definir analysisText quando AI está habilitada', async () => {
      (fetchOsmData as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_OSM_ELEMENTS);
      (fetchElevationGrid as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TERRAIN);
      (calculateStats as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS);
      (analyzeArea as ReturnType<typeof vi.fn>).mockResolvedValue('Área densa, 1 edificação.');

      const { result } = renderHook(() => useOsmEngine());

      await act(async () => {
        await result.current.runAnalysis(CENTER, RADIUS, true);
      });

      act(() => { vi.advanceTimersByTime(800); });

      expect(result.current.analysisText).toBe('Área densa, 1 edificação.');
      expect(analyzeArea).toHaveBeenCalledWith(MOCK_STATS, CENTER.label, true);
    });

    it('deve definir analysisText padrão quando AI está desabilitada', async () => {
      (fetchOsmData as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_OSM_ELEMENTS);
      (fetchElevationGrid as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TERRAIN);
      (calculateStats as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS);

      const { result } = renderHook(() => useOsmEngine());

      await act(async () => {
        await result.current.runAnalysis(CENTER, RADIUS, false);
      });

      expect(result.current.analysisText).toBe('Analysis summary disabled.');
      expect(analyzeArea).not.toHaveBeenCalled();
    });

    it('deve chamar fetchOsmData com os parâmetros corretos', async () => {
      (fetchOsmData as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_OSM_ELEMENTS);
      (fetchElevationGrid as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TERRAIN);
      (calculateStats as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS);

      const { result } = renderHook(() => useOsmEngine());

      await act(async () => {
        await result.current.runAnalysis(CENTER, RADIUS, false);
      });

      expect(fetchOsmData).toHaveBeenCalledWith(CENTER.lat, CENTER.lng, RADIUS);
    });
  });

  describe('runAnalysis — sem dados OSM', () => {
    it('deve retornar false e definir error quando OSM retorna array vazio', async () => {
      (fetchOsmData as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { result } = renderHook(() => useOsmEngine());

      let returnValue: boolean | undefined;
      await act(async () => {
        returnValue = await result.current.runAnalysis(CENTER, RADIUS, false);
      });

      act(() => { vi.advanceTimersByTime(800); });

      expect(returnValue).toBe(false);
      expect(result.current.error).toBeTruthy();
      expect(result.current.error).toContain('No architectural data found');
    });
  });

  describe('runAnalysis — tratamento de erros', () => {
    it('deve retornar false e definir error quando fetchOsmData lança exceção', async () => {
      (fetchOsmData as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Overpass API offline')
      );

      const { result } = renderHook(() => useOsmEngine());

      let returnValue: boolean | undefined;
      await act(async () => {
        returnValue = await result.current.runAnalysis(CENTER, RADIUS, false);
      });

      act(() => { vi.advanceTimersByTime(800); });

      expect(returnValue).toBe(false);
      expect(result.current.error).toBe('Overpass API offline');
      expect(result.current.isProcessing).toBe(false);
    });

    it('deve retornar false e definir error quando fetchElevationGrid falha', async () => {
      (fetchOsmData as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_OSM_ELEMENTS);
      (fetchElevationGrid as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Elevation service unavailable')
      );

      const { result } = renderHook(() => useOsmEngine());

      let returnValue: boolean | undefined;
      await act(async () => {
        returnValue = await result.current.runAnalysis(CENTER, RADIUS, false);
      });

      act(() => { vi.advanceTimersByTime(800); });

      expect(returnValue).toBe(false);
      expect(result.current.error).toBe('Elevation service unavailable');
    });

    it('sets error to "Audit failed." when thrown object has no message property', async () => {
      // Covers `err.message || "Audit failed."` right side branch
      (fetchOsmData as ReturnType<typeof vi.fn>).mockRejectedValue({});

      const { result } = renderHook(() => useOsmEngine());

      await act(async () => {
        await result.current.runAnalysis(CENTER, RADIUS, false);
      });

      act(() => { vi.advanceTimersByTime(800); });

      expect(result.current.error).toBe('Audit failed.');
      expect(result.current.isProcessing).toBe(false);
    });
  });

  describe('runAnalysis — center sem label', () => {
    it('usa "selected area" como nome padrão quando center não tem label', async () => {
      // Covers `center.label || "selected area"` right side branch
      (fetchOsmData as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_OSM_ELEMENTS);
      (fetchElevationGrid as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TERRAIN);
      (calculateStats as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS);
      (analyzeArea as ReturnType<typeof vi.fn>).mockResolvedValue('Área analisada.');

      const { result } = renderHook(() => useOsmEngine());
      const centerWithoutLabel = { lat: -22.15018, lng: -42.92185 };

      await act(async () => {
        await result.current.runAnalysis(centerWithoutLabel as any, RADIUS, true);
      });

      expect(analyzeArea).toHaveBeenCalledWith(MOCK_STATS, 'selected area', true);
    });
  });

  describe('clearData', () => {
    it('deve limpar todos os dados após análise bem-sucedida', async () => {
      (fetchOsmData as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_OSM_ELEMENTS);
      (fetchElevationGrid as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TERRAIN);
      (calculateStats as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_STATS);

      const { result } = renderHook(() => useOsmEngine());

      await act(async () => {
        await result.current.runAnalysis(CENTER, RADIUS, false);
      });

      act(() => { result.current.clearData(); });

      expect(result.current.osmData).toBeNull();
      expect(result.current.terrainData).toBeNull();
      expect(result.current.stats).toBeNull();
      expect(result.current.analysisText).toBe('');
      expect(result.current.error).toBeNull();
    });
  });

  describe('setOsmData', () => {
    it('deve permitir injeção direta de dados OSM', () => {
      const { result } = renderHook(() => useOsmEngine());

      act(() => {
        result.current.setOsmData(MOCK_OSM_ELEMENTS as any);
      });

      expect(result.current.osmData).toEqual(MOCK_OSM_ELEMENTS);
    });

    it('deve permitir limpar osmData com null', () => {
      const { result } = renderHook(() => useOsmEngine());

      act(() => { result.current.setOsmData(MOCK_OSM_ELEMENTS as any); });
      act(() => { result.current.setOsmData(null); });

      expect(result.current.osmData).toBeNull();
    });
  });
});
