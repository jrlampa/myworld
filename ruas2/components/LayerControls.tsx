import React from 'react';
import { Layers, Building2, Car, TreeDeciduous, Mountain, LampFloor } from 'lucide-react';
import { AppSettings, LayerConfig } from '../types';

interface LayerControlsProps {
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
}

const LayerControls: React.FC<LayerControlsProps> = ({ settings, onUpdateSettings }) => {
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
      className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-medium transition-all w-full ${
        active 
        ? 'bg-slate-800 border-slate-600 text-slate-200' 
        : 'bg-slate-900/50 border-slate-800 text-slate-600 hover:bg-slate-900'
      }`}
    >
      <div className={`p-1 rounded ${active ? colorClass : 'bg-slate-800 grayscale opacity-50'}`}>
        <Icon size={14} className={active ? 'text-white' : 'text-slate-500'} />
      </div>
      <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Layers size={14} className="text-slate-500" />
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtros de Exportação</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LayerButton 
          label="Edifícios" 
          icon={Building2} 
          active={settings.layers.buildings} 
          onClick={() => toggleLayer('buildings')}
          colorClass="bg-yellow-500"
        />
        <LayerButton 
          label="Vias" 
          icon={Car} 
          active={settings.layers.roads} 
          onClick={() => toggleLayer('roads')}
          colorClass="bg-red-500"
        />
        <LayerButton 
          label="Natureza" 
          icon={TreeDeciduous} 
          active={settings.layers.nature} 
          onClick={() => toggleLayer('nature')}
          colorClass="bg-green-500"
        />
        <LayerButton 
          label="Terreno" 
          icon={Mountain} 
          active={settings.layers.terrain} 
          onClick={() => toggleLayer('terrain')}
          colorClass="bg-purple-500"
        />
        <LayerButton 
          label="Detalhes" 
          icon={LampFloor} 
          active={settings.layers.furniture} 
          onClick={() => toggleLayer('furniture')}
          colorClass="bg-orange-500"
        />
      </div>
    </div>
  );
};

export default LayerControls;