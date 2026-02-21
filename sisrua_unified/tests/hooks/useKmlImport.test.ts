import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useKmlImport } from '../../src/hooks/useKmlImport';

// Mock the KML parser
vi.mock('../../src/utils/kmlParser', () => ({
  parseKml: vi.fn()
}));

import { parseKml } from '../../src/utils/kmlParser';

describe('useKmlImport', () => {
  let mockOnImportSuccess: ReturnType<typeof vi.fn>;
  let mockOnError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnImportSuccess = vi.fn();
    mockOnError = vi.fn();
    vi.clearAllMocks();
  });

  it('should initialize without processing state', () => {
    const { result } = renderHook(() =>
      useKmlImport({
        onImportSuccess: mockOnImportSuccess,
        onError: mockOnError
      })
    );

    expect(result.current.isProcessing).toBe(false);
  });

  it('should import KML file successfully', async () => {
    const mockPoints = [
      [-23.5505, -46.6333],
      [-23.5515, -46.6343],
      [-23.5525, -46.6353]
    ];

    (parseKml as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockPoints);

    const mockFile = new File(['<kml></kml>'], 'test.kml', {
      type: 'application/vnd.google-earth.kml+xml'
    });

    const { result } = renderHook(() =>
      useKmlImport({
        onImportSuccess: mockOnImportSuccess,
        onError: mockOnError
      })
    );

    await act(async () => {
      await result.current.importKml(mockFile);
    });

    await waitFor(() => {
      expect(mockOnImportSuccess).toHaveBeenCalled();
      const [points, filename] = mockOnImportSuccess.mock.calls[0];
      expect(points).toHaveLength(3);
      expect(filename).toBe('test');
    });
  });

  it('should handle KML parsing error', async () => {
    (parseKml as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Parse error')
    );

    const mockFile = new File(['invalid'], 'test.kml', {
      type: 'application/vnd.google-earth.kml+xml'
    });

    const { result } = renderHook(() =>
      useKmlImport({
        onImportSuccess: mockOnImportSuccess,
        onError: mockOnError
      })
    );

    await act(async () => {
      await result.current.importKml(mockFile);
    });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Parse error');
    });
  });

  it('should handle empty KML file', async () => {
    (parseKml as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const mockFile = new File(['<kml></kml>'], 'empty.kml', {
      type: 'application/vnd.google-earth.kml+xml'
    });

    const { result } = renderHook(() =>
      useKmlImport({
        onImportSuccess: mockOnImportSuccess,
        onError: mockOnError
      })
    );

    await act(async () => {
      await result.current.importKml(mockFile);
    });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalled();
    });
  });

  it('non-Error rejection — uses "KML import failed" fallback message', async () => {
    // Covers `error instanceof Error ? error.message : 'KML import failed'` right branch
    (parseKml as ReturnType<typeof vi.fn>).mockRejectedValueOnce('ABORT_ERR');

    const mockFile = new File(['<kml></kml>'], 'test.kml', {
      type: 'application/vnd.google-earth.kml+xml'
    });

    const { result } = renderHook(() =>
      useKmlImport({
        onImportSuccess: mockOnImportSuccess,
        onError: mockOnError
      })
    );

    await act(async () => {
      await result.current.importKml(mockFile);
    });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('KML import failed');
    });
  });
});
