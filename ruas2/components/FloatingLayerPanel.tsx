
import React, { useState } from 'react';
import { Layers, Building2, Car, TreeDeciduous, Mountain, LampFloor, Type, ChevronRight, ChevronLeft } from 'lucide-react';
import { AppSettings, LayerConfig } from '../types';

interface FloatingLayerPanelProps {
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
  isDark: boolean;
}

const FloatingLayerPanel: React.FC<FloatingLayerPanelProps> = ({ settings, onUpdateSettings, isDark }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleLayer = (key: keyof LayerConfig) => {
    onUpdateSettings({
      ...settings,
      layers: {
        ...settings.layers,
        [key]: !settings.layers[key]
      }
    });
  };

  const LayerButton = ({ label, icon: Icon, active, onClick, colorClass }: any) => (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center justify-center p-2 rounded-lg transition-all duration-200 border ${
        active 
        ? `${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'} text-blue-500 shadow-sm` 
        : 'border-transparent text-slate-500 hover:bg-slate-500/10'
      }`}
    >
      <Icon size={18} className={active ? colorClass : 'grayscale opacity-70'} />
      {isExpanded && <span className={`ml-2 text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{label}</span>}
    </button>
  );

  return (
    <div className={`absolute top-4 right-4 z-[400] flex flex-col gap-2 transition-all duration-300 ${isExpanded ? 'w-48' : 'w-12'}`}>
       
       <button 
         onClick={() => setIsExpanded(!isExpanded)}
         className={`self-end p-1.5 rounded-lg border backdrop-blur shadow-lg mb-2 transition-colors ${
           isDark 
           ? 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-white' 
           : 'bg-white/80 border-slate-200 text-slate-500 hover:text-slate-800'
         }`}
       >
         {isExpanded ? <ChevronRight size={16} /> : <Layers size={16} />}
       </button>

       <div className={`flex flex-col gap-2 p-2 rounded-xl border backdrop-blur shadow-2xl transition-all ${
          isDark 
          ? 'bg-slate-900/80 border-slate-700/50' 
          : 'bg-white/90 border-white/50'
       }`}>
          <LayerButton 
            label="Edifícios" 
            icon={Building2} 
            active={settings.layers.buildings} 
            onClick={() => toggleLayer('buildings')}
            colorClass="text-yellow-500"
          />
          <LayerButton 
            label="Vias" 
            icon={Car} 
            active={settings.layers.roads} 
            onClick={() => toggleLayer('roads')}
            colorClass="text-red-500"
          />
          <LayerButton 
            label="Natureza" 
            icon={TreeDeciduous} 
            active={settings.layers.nature} 
            onClick={() => toggleLayer('nature')}
            colorClass="text-green-500"
          />
          <LayerButton 
            label="Terreno" 
            icon={Mountain} 
            active={settings.layers.terrain} 
            onClick={() => toggleLayer('terrain')}
            colorClass="text-purple-500"
          />
          <LayerButton 
            label="Detalhes" 
            icon={LampFloor} 
            active={settings.layers.furniture} 
            onClick={() => toggleLayer('furniture')}
            colorClass="text-orange-500"
          />
          <LayerButton 
            label="Textos" 
            icon={Type} 
            active={settings.layers.labels} 
            onClick={() => toggleLayer('labels')}
            colorClass="text-blue-400"
          />
       </div>
    </div>
  );
};

export default FloatingLayerPanel;
