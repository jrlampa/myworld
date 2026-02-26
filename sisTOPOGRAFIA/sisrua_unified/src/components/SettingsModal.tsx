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

  onSaveProject?: () => void;
  onLoadProject?: (file: File) => void;
  onSaveToCloud?: () => void;
  onLoadFromCloud?: () => void;
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
  onLoadProject,
  onSaveToCloud,
  onLoadFromCloud
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
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all glass-panel-hover ${active
        ? 'border-white/40 shadow-md'
        : 'border-white/20 hover:border-white/30'
        }`}
      style={active ? { color: 'var(--enterprise-blue)' } : { color: '#64748b' }}
    >
      <div className={`p-2 rounded-md ${active ? colorClass : 'bg-white/20'}`}>
        <Icon size={18} className={active ? 'text-white' : 'text-slate-500'} />
      </div>
      <span className="text-sm font-semibold">{label}</span>
      <div className={`ml-auto w-3 h-3 rounded-full ${active ? 'shadow-md' : 'bg-slate-400'}`}
        style={active ? { backgroundColor: 'var(--enterprise-blue)' } : {}} />
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-overlay p-4">
      <div className="glass-card w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between p-6 border-b border-white/20">
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--enterprise-blue)' }}>
            <Cpu size={24} style={{ color: 'var(--enterprise-blue-light)' }} />
            Painel de Controle
          </h2>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-800 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/20">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex-1 py-3 text-sm font-medium transition-all ${activeTab === 'general'
              ? 'border-b-2 glass-panel-hover'
              : 'text-slate-600 hover:text-slate-800 hover:bg-white/20'}`}
            style={activeTab === 'general' ? {
              color: 'var(--enterprise-blue)',
              borderBottomColor: 'var(--enterprise-blue)'
            } : {}}
          >
            Geral & Exportação
          </button>
          <button
            onClick={() => setActiveTab('project')}
            className={`flex-1 py-3 text-sm font-medium transition-all ${activeTab === 'project'
              ? 'border-b-2 glass-panel-hover'
              : 'text-slate-600 hover:text-slate-800 hover:bg-white/20'}`}
            style={activeTab === 'project' ? {
              color: 'var(--enterprise-blue)',
              borderBottomColor: 'var(--enterprise-blue)'
            } : {}}
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
                  className="btn-enterprise flex items-center justify-center gap-2 p-3 rounded-lg border border-white/30 text-slate-700 hover:text-slate-900 transition-all disabled:opacity-50"
                  title="Salvar Local (.osmpro)"
                >
                  <Save size={16} /> Salvar Local
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!onLoadProject}
                  className="btn-enterprise flex items-center justify-center gap-2 p-3 rounded-lg border border-white/30 text-slate-700 hover:text-slate-900 transition-all disabled:opacity-50"
                  title="Carregar Local"
                >
                  <FolderOpen size={16} /> Abrir Local
                </button>

                <button
                  onClick={onSaveToCloud}
                  disabled={!onSaveToCloud}
                  className="btn-enterprise flex items-center justify-center gap-2 p-3 rounded-lg border border-blue-400/50 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-all disabled:opacity-50"
                  title="Salvar na Nuvem (Firestore)"
                >
                  <Save size={16} /> Salvar Nuvem
                </button>
                <button
                  onClick={onLoadFromCloud}
                  disabled={!onLoadFromCloud}
                  className="btn-enterprise flex items-center justify-center gap-2 p-3 rounded-lg border border-blue-400/50 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-all disabled:opacity-50"
                  title="Carregar da Nuvem (Firestore)"
                >
                  <FolderOpen size={16} /> Abrir Nuvem
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".osmpro,.json"
                  className="hidden"
                />
              </div>

              <div className="glass-panel p-4 rounded-lg border border-white/20">
                <div className="flex items-center gap-2 mb-4" style={{ color: 'var(--enterprise-blue)' }}>
                  <Briefcase size={18} />
                  <h3 className="font-bold text-sm uppercase">Carimbo (Title Block)</h3>
                </div>
                <p className="text-xs text-slate-600 mb-4">Dados automáticos para o arquivo CAD.</p>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-600 block mb-1">Nome do Projeto</label>
                    <input
                      type="text"
                      value={settings.projectMetadata?.projectName || ''}
                      onChange={(e) => updateMetadata('projectName', e.target.value)}
                      className="w-full glass-panel border border-white/30 rounded p-2 text-sm text-slate-800 focus:border-blue-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 block mb-1">Empresa</label>
                    <input
                      type="text"
                      value={settings.projectMetadata?.companyName || ''}
                      onChange={(e) => updateMetadata('companyName', e.target.value)}
                      className="w-full glass-panel border border-white/30 rounded p-2 text-sm text-slate-800 focus:border-blue-400 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-600 block mb-1">Responsável</label>
                      <input
                        type="text"
                        value={settings.projectMetadata?.engineerName || ''}
                        onChange={(e) => updateMetadata('engineerName', e.target.value)}
                        className="w-full glass-panel border border-white/30 rounded p-2 text-sm text-slate-800 focus:border-blue-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 block mb-1">Data</label>
                      <input
                        type="text"
                        value={settings.projectMetadata?.date || ''}
                        onChange={(e) => updateMetadata('date', e.target.value)}
                        className="w-full glass-panel border border-white/30 rounded p-2 text-sm text-slate-800 focus:border-blue-400 outline-none"
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
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Interface e Mapa</h3>

                {/* Theme Toggle */}
                <div className="flex items-center justify-between glass-panel p-3 rounded-lg">
                  <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    {settings.theme === 'dark' ? <Moon size={16} className="text-purple-500" /> : <Sun size={16} className="text-yellow-500" />}
                    Tema {settings.theme === 'dark' ? 'Escuro' : 'Claro'}
                  </span>
                  <button
                    onClick={toggleTheme}
                    className={`w-12 h-6 rounded-full relative transition-colors ${settings.theme === 'dark' ? 'bg-slate-400' : 'bg-yellow-400'}`}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${settings.theme === 'dark' ? 'translate-x-6' : ''}`} />
                  </button>
                </div>

                {/* Map Style Toggle */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMapProvider('vector')}
                    className={`btn-enterprise flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-semibold transition-all ${settings.mapProvider === 'vector'
                      ? 'border-blue-400 text-blue-600 shadow-md bg-blue-50'
                      : 'border-white/30 text-slate-600'
                      }`}
                  >
                    <MapIcon size={16} />
                    Mapa Vetorial
                  </button>
                  <button
                    onClick={() => setMapProvider('satellite')}
                    className={`btn-enterprise flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-semibold transition-all ${settings.mapProvider === 'satellite'
                      ? 'border-blue-400 text-blue-600 shadow-md bg-blue-50'
                      : 'border-white/30 text-slate-600'
                      }`}
                  >
                    <Satellite size={16} />
                    Satélite
                  </button>
                </div>
              </div>

              <div className="h-px bg-white/20" />

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
        <div className="p-6 border-t border-white/20 glass-panel rounded-b-xl space-y-3">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Exportar Resultados</h3>

          {!hasData ? (
            <div className="text-center p-3 glass-panel rounded-lg text-sm text-slate-600 border border-white/30 border-dashed">
              Realize uma análise primeiro para habilitar a exportação.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onExportGeoJSON}
                disabled={!onExportGeoJSON || isDownloading}
                className="py-3 glass-panel-hover text-slate-700 rounded-lg flex items-center justify-center gap-2 font-bold shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-xl"
              >
                <FileJson size={18} />
                GeoJSON
              </button>
              <button
                onClick={onExportDxf}
                disabled={!onExportDxf || isDownloading}
                className="py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg flex items-center justify-center gap-2 font-bold shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-xl"
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