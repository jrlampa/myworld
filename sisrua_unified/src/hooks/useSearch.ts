import { useState } from 'react';
import { GeoLocation } from '../types';
import { parseUtmQuery } from '../utils/geo';
import { API_BASE_URL } from '../config/api';

interface UseSearchProps {
  onLocationFound: (location: GeoLocation) => void;
  onError: (message: string) => void;
}

export function useSearch({ onLocationFound, onError }: UseSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const parseLatLng = (query: string): GeoLocation | null => {
    const normalized = query
      .replace(/\(([^)]+)\)/g, '$1')
      .replace(/(\d),(\d)/g, '$1.$2')
      .replace(/,/g, ' ');

    const numbers = normalized.match(/[-+]?\d+(?:\.\d+)?/g);
    if (!numbers || numbers.length < 2) return null;

    const lat = parseFloat(numbers[0]);
    const lng = parseFloat(numbers[1]);

    /* v8 ignore next */
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

    return {
      lat,
      lng,
      label: `Lat/Lng ${lat.toFixed(6)}, ${lng.toFixed(6)}`
    };
  };

  const executeSearch = async (query: string) => {
    if (!query.trim()) {
      return;
    }

    const directLocation = parseLatLng(query.trim());
    if (directLocation) {
      onLocationFound(directLocation);
      return;
    }

    const utmLocation = parseUtmQuery(query.trim());
    if (utmLocation) {
      onLocationFound(utmLocation);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error('Location not found');
      }

      const location: GeoLocation = await response.json();

      if (location) {
        onLocationFound(location);
      } else {
        throw new Error('No location data received');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Search failed';
      onError(message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeSearch(searchQuery);
  };

  return {
    searchQuery,
    setSearchQuery,
    isSearching,
    handleSearch,
    executeSearch
  };
}
