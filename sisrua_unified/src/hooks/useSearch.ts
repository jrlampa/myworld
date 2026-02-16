import { useState } from 'react';
import { GeoLocation } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

interface UseSearchProps {
  onLocationFound: (location: GeoLocation) => void;
  onError: (message: string) => void;
}

export function useSearch({ onLocationFound, onError }: UseSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const executeSearch = async (query: string) => {
    if (!query.trim()) {
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
