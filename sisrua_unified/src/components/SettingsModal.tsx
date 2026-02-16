import React, { useState, useRef } from 'react';
import { X, Cpu, Zap, Layers, TreeDeciduous, Car, Building2, Mountain, LampFloor, Globe, Circle, Hexagon, Square, Eraser, Download, FileJson, Loader2, Moon, Sun, Map as MapIcon, Satellite, Type, Briefcase, Activity, Upload, Save, FolderOpen, PencilRuler, ArrowLeftRight, Grid3X3, AlertTriangle } from 'lucide-react';
import { AppSettings, LayerConfig, ProjectionType, SelectionMode, GeoLocation, MapProvider, SimplificationLevel, ProjectMetadata } from '../types';
import { MAX_RADIUS, MIN_RADIUS } from '../constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;

  // Selection Props
  selectionMode?: SelectionMode;
  onSelectionModeChange?: (mode: SelectionMode) => void;
  radius?: number;
  onRadiusChange?: (radius: number) => void;
  polygon?: GeoLocation[];
  onClearPolygon?: () => void;

  // Export Props
  hasData?: boolean;
  isDownloading?: boolean;
  onExportDxf?: () => void;
  onExportGeoJSON?: () => void;

  // Persistence Props
  onSaveProject?: () => void;
  onLoadProject?: (file: File) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  selectionMode,
  onSelectionModeChange,
  radius,
  onRadiusChange,
  polygon,
  onClearPolygon,
  hasData,
  isDownloading,
  onExportDxf,
  onExportGeoJSON,
  onSaveProject,
  onLoadProject
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'project'>('general');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const setSimplification = (level: SimplificationLevel) => onUpdateSettings({ ...settings, simplificationLevel: level });
  const toggleTheme = () => onUpdateSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' });

  const setProjection = (proj: ProjectionType) => onUpdateSettings({ ...settings, projection: proj });
  const setMapProvider = (provider: MapProvider) => onUpdateSettings({ ...settings, mapProvider: provider });

  const toggleLayer = (key: keyof LayerConfig) => {
    onUpdateSettings({
      ...settings,
      layers: {
        ...settings.layers,
        [key]: !settings.layers[key]
      }
    });
  };

  const updateMetadata = (key: keyof ProjectMetadata, value: string) => {
    onUpdateSettings({
      ...settings,
      projectMetadata: {
        ...settings.projectMetadata,
        [key]: value
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onLoadProject) {
      onLoadProject(file);
    }
  };

  const LayerToggle = ({ label, icon: Icon, active, onClick, colorClass }: any) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${active
        ? 'bg-slate-800 border-blue-500/50 text-white shadow-sm'
        : 'bg-slate-900 border-slate-700 text-slate-500 hover:bg-slate-800'
        }`}
    >
      <div className={`p-2 rounded-md ${active ? colorClass : 'bg-slate-800'}`}>
        <Icon size={18} className={active ? 'text-white' : 'text-slate-500'} />
      </div>
      <span className="text-sm font-medium">{label}</span>
      <div className={`ml-auto w-3 h-3 rounded-full ${active ? 'bg-blue-500' : 'bg-slate-700'}`} />
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu size={24} className="text-blue-500" />
            Painel de Controle
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'general' ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Geral & Exportação
          </button>
          <button
            onClick={() => setActiveTab('project')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'project' ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Projeto & Metadados
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar flex-1">

          {activeTab === 'project' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Project Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onSaveProject}
                  disabled={!onSaveProject}
                  className="flex items-center justify-center gap-2 p-3 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50"
                >
                  <Save size={16} /> Salvar Projeto (.osmpro)
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!onLoadProject}
                  className="flex items-center justify-center gap-2 p-3 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50"
                >
                  <FolderOpen size={16} /> Carregar Projeto
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".osmpro,.json"
                  className="hidden"
                />
              </div>

              <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
                <div className="flex items-center gap-2 mb-4 text-blue-400">
                  <Briefcase size={18} />
                  <h3 className="font-bold text-sm uppercase">Carimbo (Title Block)</h3>
                </div>
                <p className="text-xs text-slate-400 mb-4">Dados automáticos para o arquivo CAD.</p>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Nome do Projeto</label>
                    <input
                      type="text"
                      value={settings.projectMetadata?.projectName || ''}
                      onChange={(e) => updateMetadata('projectName', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Empresa</label>
                    <input
                      type="text"
                      value={settings.projectMetadata?.companyName || ''}
                      onChange={(e) => updateMetadata('companyName', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Responsável</label>
                      <input
                        type="text"
                        value={settings.projectMetadata?.engineerName || ''}
                        onChange={(e) => updateMetadata('engineerName', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Data</label>
                      <input
                        type="text"
                        value={settings.projectMetadata?.date || ''}
                        onChange={(e) => updateMetadata('date', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Appearance Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Interface e Mapa</h3>

                {/* Theme Toggle */}
                <div className="flex items-center justify-between bg-slate-800/30 p-3 rounded-lg">
                  <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    {settings.theme === 'dark' ? <Moon size={16} className="text-purple-400" /> : <Sun size={16} className="text-yellow-400" />}
                    Tema {settings.theme === 'dark' ? 'Escuro' : 'Claro'}
                  </span>
                  <button
                    onClick={toggleTheme}
                    className={`w-12 h-6 rounded-full relative transition-colors ${settings.theme === 'dark' ? 'bg-slate-700' : 'bg-yellow-500'}`}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${settings.theme === 'dark' ? 'translate-x-6' : ''}`} />
                  </button>
                </div>

                {/* Map Style Toggle */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMapProvider('vector')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${settings.mapProvider === 'vector'
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                      }`}
                  >
                    <MapIcon size={16} />
                    Mapa Vetorial
                  </button>
                  <button
                    onClick={() => setMapProvider('satellite')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${settings.mapProvider === 'satellite'
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                      }`}
                  >
                    <Satellite size={16} />
                    Satélite
                  </button>
                </div>
              </div>

              <div className="h-px bg-slate-800" />

              {/* Filters / Layers Section */}
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

                  {/* Auto-Dimension Toggle */}
                  <div className={`ml-8 flex items-center gap-3 p-2 rounded-lg border transition-all ${settings.layers.dimensions ? 'bg-slate-800 border-blue-500/50' : 'bg-slate-900 border-slate-800'}`}>
                    <button
                      onClick={() => toggleLayer('dimensions')}
                      className="flex items-center gap-2 text-xs w-full text-left"
                    >
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

                  {/* Curbs Toggle */}
                  {settings.layers.roads && (
                    <div className={`ml-8 flex items-center gap-3 p-2 rounded-lg border transition-all ${settings.layers.curbs ? 'bg-slate-800 border-red-500/50' : 'bg-slate-900 border-slate-800'}`}>
                      <button
                        onClick={() => toggleLayer('curbs')}
                        className="flex items-center gap-2 text-xs w-full text-left"
                      >
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

                  {/* Slope Analysis Toggle */}
                  {settings.layers.terrain && (
                    <div className={`ml-8 flex items-center gap-3 p-2 rounded-lg border transition-all ${settings.layers.slopeAnalysis ? 'bg-slate-800 border-orange-500/50' : 'bg-slate-900 border-slate-800'}`}>
                      <button
                        onClick={() => toggleLayer('slopeAnalysis')}
                        className="flex items-center gap-2 text-xs w-full text-left"
                      >
                        <AlertTriangle size={14} className={settings.layers.slopeAnalysis ? 'text-orange-400' : 'text-slate-600'} />
                        <span className={settings.layers.slopeAnalysis ? 'text-orange-200' : 'text-slate-500'}>Hachura de Declividade Crítica</span>
                        <div className={`ml-auto w-2 h-2 rounded-full ${settings.layers.slopeAnalysis ? 'bg-orange-500' : 'bg-slate-700'}`} />
                      </button>
                    </div>
                  )}

                  {/* Contour Settings if active */}
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

                  {/* Coordinate Grid Toggle */}
                  <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${settings.layers.grid ? 'bg-slate-800 border-white/30 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                    <div className="p-2 bg-slate-800 rounded-md">
                      <Grid3X3 size={18} className={settings.layers.grid ? 'text-white' : 'text-slate-500'} />
                    </div>
                    <button
                      onClick={() => toggleLayer('grid')}
                      className="flex-1 text-left text-sm font-medium"
                    >
                      Malha de Coordenadas (Grid)
                    </button>
                    <div className={`w-3 h-3 rounded-full ${settings.layers.grid ? 'bg-blue-500' : 'bg-slate-700'}`} />
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-800" />

              {/* System Configs */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sistema</h3>

                <div className="bg-slate-800/30 p-3 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={14} className="text-yellow-500" />
                    <span className="text-xs font-bold text-slate-400 uppercase">Processamento Geométrico</span>
                  </div>

                  {/* Simplification */}
                  <div className="flex gap-1 mb-2">
                    {(['off', 'low', 'medium', 'high'] as SimplificationLevel[]).map((level) => (
                      <button
                        key={level}
                        onClick={() => setSimplification(level)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded border transition-all capitalize ${settings.simplificationLevel === level
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>

                  {/* Orthogonalization Toggle */}
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
                    <button
                      onClick={() => setProjection('local')}
                      className={`flex-1 py-1.5 text-xs font-medium rounded border transition-all ${settings.projection === 'local'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                      Local (Relativo)
                    </button>
                    <button
                      onClick={() => setProjection('utm')}
                      className={`flex-1 py-1.5 text-xs font-medium rounded border transition-all ${settings.projection === 'utm'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                      UTM (Absoluto)
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    UTM Absoluto usa coordenadas reais compatíveis com Google Earth e GPS
                  </p>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Footer with Export Actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/80 rounded-b-xl space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Exportar Resultados</h3>

          {!hasData ? (
            <div className="text-center p-3 bg-slate-800/50 rounded-lg text-sm text-slate-500 border border-slate-800 border-dashed">
              Realize uma análise primeiro para habilitar a exportação.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onExportGeoJSON}
                disabled={!onExportGeoJSON || isDownloading}
                className="py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center justify-center gap-2 font-bold shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <FileJson size={18} />
                GeoJSON
              </button>
              <button
                onClick={onExportDxf}
                disabled={!onExportDxf || isDownloading}
                className="py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg flex items-center justify-center gap-2 font-bold shadow-lg shadow-green-900/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isDownloading ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                DXF (CAD)
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;