import { useState } from 'react';
import { fetchElevationProfile } from '../services/elevationService';
import { GeoLocation } from '../types';

interface ElevationDataPoint {
  dist: number;
  elev: number;
}

export function useElevationProfile() {
  const [profileData, setProfileData] = useState<ElevationDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = async (start: GeoLocation, end: GeoLocation) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const profile = await fetchElevationProfile(start, end);
      setProfileData(profile);
      return profile;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load elevation profile';
      setError(message);
      setProfileData([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const clearProfile = () => {
    setProfileData([]);
    setError(null);
  };

  return {
    profileData,
    isLoading,
    error,
    loadProfile,
    clearProfile
  };
}
