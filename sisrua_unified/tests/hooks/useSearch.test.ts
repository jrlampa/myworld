import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSearch } from '../../src/hooks/useSearch';

global.fetch = vi.fn();

describe('useSearch', () => {
  let mockOnLocationFound: ReturnType<typeof vi.fn>;
  let mockOnError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnLocationFound = vi.fn();
    mockOnError = vi.fn();
    vi.clearAllMocks();
  });

  it('should initialize with empty search query', () => {
    const { result } = renderHook(() =>
      useSearch({
        onLocationFound: mockOnLocationFound,
        onError: mockOnError
      })
    );

    expect(result.current.searchQuery).toBe('');
    expect(result.current.isSearching).toBe(false);
  });

  it('should update search query', () => {
    const { result } = renderHook(() =>
      useSearch({
        onLocationFound: mockOnLocationFound,
        onError: mockOnError
      })
    );

    act(() => {
      result.current.setSearchQuery('São Paulo');
    });

    expect(result.current.searchQuery).toBe('São Paulo');
  });

  it('should search successfully', async () => {
    const mockLocation = {
      lat: -23.5505,
      lng: -46.6333,
      label: 'São Paulo'
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockLocation
    });

    const { result } = renderHook(() =>
      useSearch({
        onLocationFound: mockOnLocationFound,
        onError: mockOnError
      })
    );

    act(() => {
      result.current.setSearchQuery('São Paulo');
    });

    await act(async () => {
      await result.current.executeSearch('São Paulo');
    });

    await waitFor(() => {
      expect(mockOnLocationFound).toHaveBeenCalledWith(mockLocation);
    });
  });

  it('should handle search error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false
    });

    const { result } = renderHook(() =>
      useSearch({
        onLocationFound: mockOnLocationFound,
        onError: mockOnError
      })
    );

    await act(async () => {
      await result.current.executeSearch('Invalid Location');
    });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Location not found');
    });
  });

  it('should not search with empty query', async () => {
    const { result } = renderHook(() =>
      useSearch({
        onLocationFound: mockOnLocationFound,
        onError: mockOnError
      })
    );

    await act(async () => {
      await result.current.executeSearch('');
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
