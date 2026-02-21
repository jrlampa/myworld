import React from 'react';
import {
  Zap, Layers, Car, Building2, Mountain, LampFloor, Globe, Moon, Sun,
  Map as MapIcon, Satellite, Type, Activity, ArrowLeftRight, Grid3X3,
  AlertTriangle, PencilRuler, Bolt,
} from 'lucide-react';
import { AppSettings, LayerConfig, ProjectionType, MapProvider, SimplificationLevel } from '../../types';
import LayerToggle from './LayerToggle';

interface GeneralTabProps {
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
}

const GeneralTab: React.FC<GeneralTabProps> = ({ settings, onUpdateSettings }) => {
  const setSimplification = (level: SimplificationLevel) =>
    onUpdateSettings({ ...settings, simplificationLevel: level });

  const toggleTheme = () =>
    onUpdateSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' });

  const setProjection = (proj: ProjectionType) =>
    onUpdateSettings({ ...settings, projection: proj });

  const setMapProvider = (provider: MapProvider) =>
    onUpdateSettings({ ...settings, mapProvider: provider });

  const toggleLayer = (key: keyof LayerConfig) => {
    onUpdateSettings({
      ...settings,
      layers: { ...settings.layers, [key]: !settings.layers[key] },
    });
  };

  return (
    <>
      {/* Aparência */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Interface e Mapa</h3>

        <div className="flex items-center justify-between glass-panel p-3 rounded-lg">
          <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
            {settings.theme === 'dark'
              ? <Moon size={16} className="text-purple-500" />
              : <Sun size={16} className="text-yellow-500" />}
            Tema {settings.theme === 'dark' ? 'Escuro' : 'Claro'}
          </span>
          <button
            onClick={toggleTheme}
            className={`w-12 h-6 rounded-full relative transition-colors ${settings.theme === 'dark' ? 'bg-slate-400' : 'bg-yellow-400'}`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${settings.theme === 'dark' ? 'translate-x-6' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(['vector', 'satellite'] as MapProvider[]).map((provider) => (
            <button
              key={provider}
              onClick={() => setMapProvider(provider)}
              className={`btn-enterprise flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-semibold transition-all ${settings.mapProvider === provider
                ? 'border-blue-400 text-blue-600 shadow-md bg-blue-50'
                : 'border-white/30 text-slate-600'}`}
            >
              {provider === 'vector' ? <MapIcon size={16} /> : <Satellite size={16} />}
              {provider === 'vector' ? 'Mapa Vetorial' : 'Satélite'}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-white/20" />

      {/* Camadas DXF */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-slate-400" />
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Camadas DXF</h3>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <LayerToggle
            label="Edificações (Hatch Sólido)"
            icon={Building2}
            active={settings.layers.buildings}
            onClick={() => toggleLayer('buildings')}
            colorClass="bg-yellow-500/20 text-yellow-500"
          />

          <div className={`ml-8 flex items-center gap-3 p-2 rounded-lg border transition-all ${settings.layers.dimensions ? 'bg-slate-800 border-blue-500/50' : 'bg-slate-900 border-slate-800'}`}>
            <button onClick={() => toggleLayer('dimensions')} role="switch" aria-checked={settings.layers.dimensions} className="flex items-center gap-2 text-xs w-full text-left">
              <PencilRuler size={14} className={settings.layers.dimensions ? 'text-blue-400' : 'text-slate-600'} />
              <span className={settings.layers.dimensions ? 'text-blue-200' : 'text-slate-500'}>Gerar Cotas Automáticas</span>
              <div className={`ml-auto w-2 h-2 rounded-full ${settings.layers.dimensions ? 'bg-blue-500' : 'bg-slate-700'}`} />
            </button>
          </div>

          <LayerToggle
            label="Vias (Eixos e Bordas)"
            icon={Car}
            active={settings.layers.roads}
            onClick={() => toggleLayer('roads')}
            colorClass="bg-red-500/20 text-red-500"
          />

          {settings.layers.roads && (
            <div className={`ml-8 flex items-center gap-3 p-2 rounded-lg border transition-all ${settings.layers.curbs ? 'bg-slate-800 border-red-500/50' : 'bg-slate-900 border-slate-800'}`}>
              <button onClick={() => toggleLayer('curbs')} role="switch" aria-checked={settings.layers.curbs} className="flex items-center gap-2 text-xs w-full text-left">
                <ArrowLeftRight size={14} className={settings.layers.curbs ? 'text-red-400' : 'text-slate-600'} />
                <span className={settings.layers.curbs ? 'text-red-200' : 'text-slate-500'}>Gerar Guias e Sarjetas (Offsets)</span>
                <div className={`ml-auto w-2 h-2 rounded-full ${settings.layers.curbs ? 'bg-red-500' : 'bg-slate-700'}`} />
              </button>
            </div>
          )}

          <LayerToggle
            label="Terreno (Malha 3D)"
            icon={Mountain}
            active={settings.layers.terrain}
            onClick={() => toggleLayer('terrain')}
            colorClass="bg-purple-500/20 text-purple-500"
          />
          <LayerToggle
            label="Curvas de Nível (Isolinhas)"
            icon={Activity}
            active={settings.layers.contours}
            onClick={() => toggleLayer('contours')}
            colorClass="bg-pink-500/20 text-pink-500"
          />

          {settings.layers.terrain && (
            <div className={`ml-8 flex items-center gap-3 p-2 rounded-lg border transition-all ${settings.layers.slopeAnalysis ? 'bg-slate-800 border-orange-500/50' : 'bg-slate-900 border-slate-800'}`}>
              <button onClick={() => toggleLayer('slopeAnalysis')} role="switch" aria-checked={settings.layers.slopeAnalysis} className="flex items-center gap-2 text-xs w-full text-left">
                <AlertTriangle size={14} className={settings.layers.slopeAnalysis ? 'text-orange-400' : 'text-slate-600'} />
                <span className={settings.layers.slopeAnalysis ? 'text-orange-200' : 'text-slate-500'}>Hachura de Declividade Crítica</span>
                <div className={`ml-auto w-2 h-2 rounded-full ${settings.layers.slopeAnalysis ? 'bg-orange-500' : 'bg-slate-700'}`} />
              </button>
            </div>
          )}

          {settings.layers.contours && (
            <div className="ml-12 p-3 bg-slate-950/50 rounded-lg border border-slate-800 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>Intervalo de Curva</span>
                <span className="text-white font-mono">{settings.contourInterval}m</span>
              </div>
              <input
                type="range"
                min={1}
                max={50}
                step={1}
                value={settings.contourInterval || 5}
                onChange={(e) => onUpdateSettings({ ...settings, contourInterval: parseInt(e.target.value) })}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
              />
            </div>
          )}

          <LayerToggle
            label="Detalhes (Árvores/Postes)"
            icon={LampFloor}
            active={settings.layers.furniture}
            onClick={() => toggleLayer('furniture')}
            colorClass="bg-orange-500/20 text-orange-500"
          />
          <LayerToggle
            label="Rótulos e Dados BIM"
            icon={Type}
            active={settings.layers.labels}
            onClick={() => toggleLayer('labels')}
            colorClass="bg-white/20 text-white"
          />

          <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${settings.layers.grid ? 'bg-slate-800 border-white/30 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
            <div className="p-2 bg-slate-800 rounded-md">
              <Grid3X3 size={18} className={settings.layers.grid ? 'text-white' : 'text-slate-500'} />
            </div>
            <button onClick={() => toggleLayer('grid')} className="flex-1 text-left text-sm font-medium">
              Malha de Coordenadas (Grid)
            </button>
            <div className={`w-3 h-3 rounded-full ${settings.layers.grid ? 'bg-blue-500' : 'bg-slate-700'}`} />
          </div>
        </div>
      </div>

      <div className="h-px bg-white/20" />

      {/* Normas ANEEL/PRODIST */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Bolt size={16} className="text-yellow-400" />
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Infraestrutura Elétrica</h3>
        </div>

        <LayerToggle
          label="Rede Elétrica (ANEEL/PRODIST)"
          icon={Zap}
          active={settings.layers.power}
          onClick={() => toggleLayer('power')}
          colorClass="bg-yellow-500/20 text-yellow-500"
        />

        {settings.layers.power && (
          <div
            className={`p-3 rounded-lg border transition-all ${
              settings.aneelProdist
                ? 'bg-yellow-500/10 border-yellow-500/40'
                : 'bg-slate-900 border-slate-700'
            }`}
          >
            <button
              onClick={() => onUpdateSettings({ ...settings, aneelProdist: !settings.aneelProdist })}
              className="flex items-center gap-3 w-full text-left"
              role="switch"
              aria-checked={settings.aneelProdist}
            >
              <Bolt
                size={16}
                className={settings.aneelProdist ? 'text-yellow-400' : 'text-slate-600'}
              />
              <div className="flex-1">
                <p className={`text-xs font-semibold ${settings.aneelProdist ? 'text-yellow-200' : 'text-slate-400'}`}>
                  Aplicar Normas ANEEL/PRODIST
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Substitui ABNT para camadas elétricas (AT/MT/BT)
                </p>
              </div>
              <div className={`w-3 h-3 rounded-full ${settings.aneelProdist ? 'bg-yellow-400' : 'bg-slate-700'}`} />
            </button>
          </div>
        )}
      </div>

      <div className="h-px bg-slate-800" />

      {/* Sistema */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sistema</h3>

        <div className="bg-slate-800/30 p-3 rounded-lg space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-yellow-500" />
            <span className="text-xs font-bold text-slate-400 uppercase">Processamento Geométrico</span>
          </div>
          <div className="flex gap-1 mb-2">
            {(['off', 'low', 'medium', 'high'] as SimplificationLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setSimplification(level)}
                className={`flex-1 py-1.5 text-xs font-medium rounded border transition-all capitalize ${settings.simplificationLevel === level
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'}`}
              >
                {level}
              </button>
            ))}
          </div>
          <button
            onClick={() => onUpdateSettings({ ...settings, orthogonalize: !settings.orthogonalize })}
            className={`w-full flex items-center justify-between p-2 rounded border text-xs ${settings.orthogonalize ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-200' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
          >
            <div className="flex items-center gap-2">
              <ArrowLeftRight size={14} className={settings.orthogonalize ? 'text-indigo-400' : 'text-slate-600'} />
              <span>Forçar Ângulos Retos (Squaring)</span>
            </div>
            <div className={`w-3 h-3 rounded-full ${settings.orthogonalize ? 'bg-indigo-500' : 'bg-slate-700'}`} />
          </button>
        </div>

        <div className="bg-slate-800/30 p-3 rounded-lg space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Globe size={14} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-400 uppercase">Projeção DXF</span>
          </div>
          <div className="flex gap-2">
            {(['local', 'utm'] as ProjectionType[]).map((proj) => (
              <button
                key={proj}
                onClick={() => setProjection(proj)}
                className={`flex-1 py-1.5 text-xs font-medium rounded border transition-all ${settings.projection === proj
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'}`}
              >
                {proj === 'local' ? 'Local (Relativo)' : 'UTM (Absoluto)'}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            UTM Absoluto usa coordenadas reais compatíveis com Google Earth e GPS
          </p>
        </div>
      </div>
    </>
  );
};

export default GeneralTab;
