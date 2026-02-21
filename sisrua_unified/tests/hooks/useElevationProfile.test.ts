import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useElevationProfile } from '../../src/hooks/useElevationProfile';

// Mock the service
vi.mock('../../src/services/elevationService', () => ({
  fetchElevationProfile: vi.fn()
}));

import { fetchElevationProfile } from '../../src/services/elevationService';

describe('useElevationProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty profile data', () => {
    const { result } = renderHook(() => useElevationProfile());

    expect(result.current.profileData).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should load elevation profile successfully', async () => {
    const mockProfile = [
      { dist: 0, elev: 100 },
      { dist: 50, elev: 120 },
      { dist: 100, elev: 110 }
    ];

    (fetchElevationProfile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockProfile);

    const { result } = renderHook(() => useElevationProfile());

    const start = { lat: -23.5505, lng: -46.6333 };
    const end = { lat: -23.5515, lng: -46.6343 };

    await act(async () => {
      await result.current.loadProfile(start, end);
    });

    await waitFor(() => {
      expect(result.current.profileData).toEqual(mockProfile);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  it('should handle loading error', async () => {
    (fetchElevationProfile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('API Error')
    );

    const { result } = renderHook(() => useElevationProfile());

    const start = { lat: -23.5505, lng: -46.6333 };
    const end = { lat: -23.5515, lng: -46.6343 };

    await act(async () => {
      await result.current.loadProfile(start, end);
    });

    await waitFor(() => {
      expect(result.current.profileData).toEqual([]);
      expect(result.current.error).toBeTruthy();
    });
  });

  it('non-Error rejection — uses "Failed to load elevation profile" fallback', async () => {
    // Covers `err instanceof Error ? err.message : 'Failed to load elevation profile'` right branch
    (fetchElevationProfile as ReturnType<typeof vi.fn>).mockRejectedValueOnce('ABORT_ERR');

    const { result } = renderHook(() => useElevationProfile());

    const start = { lat: -22.15018, lng: -42.92185 };
    const end = { lat: -22.15100, lng: -42.92100 };

    await act(async () => {
      await result.current.loadProfile(start, end);
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to load elevation profile');
      expect(result.current.profileData).toEqual([]);
    });
  });

  it('should clear profile', () => {
    const { result } = renderHook(() => useElevationProfile());

    act(() => {
      result.current.clearProfile();
    });

    expect(result.current.profileData).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
