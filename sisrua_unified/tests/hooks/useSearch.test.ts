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

  it('parseLatLng: finds UTM query and calls onLocationFound without fetch', async () => {
    // UTM 23K canonical coords → parsed directly without network call
    const { result } = renderHook(() =>
      useSearch({ onLocationFound: mockOnLocationFound, onError: mockOnError })
    );

    await act(async () => {
      // UTM query format triggers parseUtmQuery in useSearch
      await result.current.executeSearch('23K 788547 7634925');
    });

    // UTM parsed → onLocationFound called, no HTTP request
    expect(mockOnLocationFound).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('parseLatLng: finds direct lat/lng and calls onLocationFound without fetch', async () => {
    const { result } = renderHook(() =>
      useSearch({ onLocationFound: mockOnLocationFound, onError: mockOnError })
    );

    await act(async () => {
      await result.current.executeSearch('-22.15018 -42.92185');
    });

    expect(mockOnLocationFound).toHaveBeenCalledWith(
      expect.objectContaining({ lat: -22.15018, lng: -42.92185 })
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('handles null response body from server', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => null
    });

    const { result } = renderHook(() =>
      useSearch({ onLocationFound: mockOnLocationFound, onError: mockOnError })
    );

    await act(async () => {
      await result.current.executeSearch('unknown place XYZ');
    });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('No location data received');
    });
  });

  it('handles network error (fetch throws)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() =>
      useSearch({ onLocationFound: mockOnLocationFound, onError: mockOnError })
    );

    await act(async () => {
      await result.current.executeSearch('some query that needs network');
    });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Network failure');
    });
  });

  it('handleSearch: submits form and calls executeSearch', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lat: -22.15018, lng: -42.92185, label: 'Muriaé' })
    });

    const { result } = renderHook(() =>
      useSearch({ onLocationFound: mockOnLocationFound, onError: mockOnError })
    );

    act(() => {
      result.current.setSearchQuery('Muriaé');
    });

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    await act(async () => {
      await result.current.handleSearch(fakeEvent);
    });

    expect(fakeEvent.preventDefault).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockOnLocationFound).toHaveBeenCalled();
    });
  });

  it('handles non-Error rejection — uses "Search failed" fallback message', async () => {
    // Covers `error instanceof Error ? error.message : 'Search failed'` right branch
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce('ABORT_ERR');

    const { result } = renderHook(() =>
      useSearch({ onLocationFound: mockOnLocationFound, onError: mockOnError })
    );

    await act(async () => {
      await result.current.executeSearch('Muriaé MG');
    });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Search failed');
    });
  });
});
