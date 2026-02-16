import React from 'react';
import { Search, Loader2, Map as MapIcon } from 'lucide-react';
import { GeoLocation } from '../types';

interface SearchControlProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  handleSearch: (e: React.FormEvent) => void;
  isSearching: boolean;
  center: GeoLocation;
}

const SearchControl: React.FC<SearchControlProps> = ({ 
  searchQuery, 
  setSearchQuery, 
  handleSearch, 
  isSearching, 
  center 
}) => {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Localização Alvo</label>
      <form onSubmit={handleSearch} className="relative">
        <input 
          type="text" 
          placeholder='Busca Smart: Endereço ou "-23.55, -46.63"'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-white placeholder-slate-500"
        />
        <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
        <button 
          type="submit" 
          disabled={isSearching || !searchQuery}
          className="absolute right-2 top-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-2 py-1 rounded transition-colors disabled:opacity-50"
        >
          {isSearching ? <Loader2 className="animate-spin" size={14} /> : "Buscar"}
        </button>
      </form>
      {center.label && (
        <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-900/20 p-2 rounded border border-blue-900/50">
          <MapIcon size={12} />
          <span className="truncate">{center.label} ({center.lat.toFixed(4)}, {center.lng.toFixed(4)})</span>
        </div>
      )}
    </div>
  );
};

export default SearchControl;