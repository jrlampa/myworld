import React, { useState } from 'react';

interface SearchBarProps {
  onSelectLocation: (lat: number, lon: number) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSelectLocation }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ display_name: string, lat: string, lon: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!query) return;
    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error("Geocoding error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (lat: string, lon: string) => {
    onSelectLocation(parseFloat(lat), parseFloat(lon));
    setResults([]);
    setQuery('');
  };

  return (
    <div className="search-container">
      <div className="glass search-input-wrapper">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search address..."
          className="search-input"
        />
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="search-icon-btn"
        >
          🔍
        </button>
      </div>

      {results.length > 0 && (
        <ul className="glass search-results">
          {results.map((res, i) => (
            <li
              key={i}
              onClick={() => handleSelect(res.lat, res.lon)}
              className="search-result-item"
            >
              {res.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchBar;
