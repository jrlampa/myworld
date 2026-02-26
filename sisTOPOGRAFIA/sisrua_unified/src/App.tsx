import React, { useState, useEffect } from 'react';
import { Download, Map as MapIcon, Layers, Search, Loader2, AlertCircle, Settings, Mountain, TrendingUp, FileText, Ruler } from 'lucide-react';
import { AnalysisStats, GlobalState, AppSettings, GeoLocation, SelectionMode } from './types';
import { DEFAULT_LOCATION, MAX_RADIUS, MIN_RADIUS } from './constants';
import MapSelector from './components/MapSelector';
import Dashboard from './components/Dashboard';
import SettingsModal from './components/SettingsModal';
import HistoryControls from './components/HistoryControls';
import DxfLegend from './components/DxfLegend';
import FloatingLayerPanel from './components/FloatingLayerPanel';
import ElevationProfile from './components/ElevationProfile';
import BatchUpload from './components/BatchUpload';
import Toast, { ToastType } from './components/Toast';
import ProgressIndicator from './components/ProgressIndicator';
import LoginButton from './components/LoginButton';
import DxfPreviewOverlay from './components/DxfPreviewOverlay';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useOsmEngine } from './hooks/useOsmEngine';
import { useSearch } from './hooks/useSearch';
import { useDxfExport } from './hooks/useDxfExport';
import { useKmlImport } from './hooks/useKmlImport';
import { useFileOperations } from './hooks/useFileOperations';
import { useElevationProfile } from './hooks/useElevationProfile';
import { useCloudStorage } from './hooks/useCloudStorage';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const { state: appState, setState: setAppState, undo, redo, canUndo, canRedo, saveSnapshot } = useUndoRedo<GlobalState>({
    center: DEFAULT_LOCATION,
    radius: 500,
    selectionMode: 'circle',
    polygon: [],
    measurePath: [],
    settings: {
      enableAI: true,
      simplificationLevel: 'low',
      orthogonalize: true,
      projection: 'utm',
      theme: 'dark',
      mapProvider: 'vector',
      contourInterval: 5,
      layers: { buildings: true, roads: true, curbs: true, nature: true, terrain: true, contours: true, furniture: true, labels: true },
      projectMetadata: { projectName: 'SISRUA EVOLUTION', companyName: 'SISTOPO', engineerName: 'SOTA ENGINEER', date: new Date().toLocaleDateString('pt-BR'), scale: '1:1000', revision: 'P3' }
    }
  });

  const { center, radius, selectionMode, polygon, settings } = appState;
  const isDark = settings.theme === 'dark';
  const [targetZ, setTargetZ] = useState<number>(0);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  const { isProcessing, progressValue, statusMessage, osmData, terrainData, stats, analysisText, error, runAnalysis, clearData } = useOsmEngine();
  const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const showToast = (message: string, type: ToastType) => setToast({ message, type });

  const { searchQuery, setSearchQuery, isSearching, handleSearch } = useSearch({
    onLocationFound: (location) => {
      setAppState({ ...appState, center: location }, true);
      clearData();
      showToast(`Localizado: ${location.label}`, 'success');
    },
    onError: (message) => showToast(message, 'error')
  });

  const { downloadDxf, isDownloading, jobId, jobStatus, jobProgress, previewUrl, confirmDownload, clearPreview } = useDxfExport({
    onSuccess: (message) => showToast(message, 'success'),
    onError: (message) => showToast(message, 'error')
  });

  const handleFetchAndAnalyze = async () => {
    const success = await runAnalysis(center, radius, settings.enableAI);
    if (success) showToast("Análise de Terreno Concluída!", 'success');
  };

  const handleDownloadDxf = async () => {
    await downloadDxf(center, radius, selectionMode, polygon, settings.layers, settings.projection);
  };

  const handlePadAnalysis = async () => {
    if (polygon.length < 3) {
      showToast("Selecione um polígono para análise de corte/aterro", "warning");
      return;
    }
    showToast(`Iniciando Cálculo de Terraplenagem (Z=${targetZ}m)...`, "info");
    // Implementation for calling /api/analyze-pad would go here or in a hook
  };

  return (
    <div className={`flex flex-col h-screen w-full font-sans transition-all duration-500 overflow-hidden ${isDark ? 'dark bg-[#020617] text-slate-200' : 'bg-slate-50 text-slate-900'}`}>
      <AnimatePresence>
        {toast && <Toast key="toast" message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      <header className="h-20 border-b flex items-center justify-between px-8 shrink-0 z-30 glass">
        <div className="flex items-center gap-4">
          <motion.div whileHover={{ rotate: 180 }} className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
            <Layers size={22} className="text-white" />
          </motion.div>
          <div>
            <h1 className="text-xl font-black tracking-tighter flex items-center gap-2">
              SISTOPO <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-[10px] font-mono border border-blue-500/20">PREMIUM</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Topografia & Engenharia IoT</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <HistoryControls canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
          <motion.button whileHover={{ scale: 1.05 }} onClick={() => setShowSettings(true)} className="p-2.5 glass rounded-xl text-slate-300 hover:text-white transition-all shadow-lg">
            <Settings size={20} />
          </motion.button>
          <LoginButton />
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <motion.aside initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="w-[420px] border-r flex flex-col p-8 gap-6 overflow-y-auto z-20 glass scrollbar-hide">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Pesquisa de Geometria</label>
            <form onSubmit={handleSearch} className="relative group">
              <input type="text" placeholder='Cidade, Endereço ou UTM' value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-500/50 text-white placeholder-slate-600 transition-all" />
              <Search className="absolute left-4 top-4.5 text-slate-600" size={18} />
            </form>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Modo de Seleção</label>
            </div>
            <div className="flex p-1 bg-slate-900/50 rounded-xl border border-white/5">
              <button onClick={() => setAppState({ ...appState, selectionMode: 'circle' }, true)} className={`flex-1 text-[10px] font-bold py-2.5 rounded-lg transition-all ${selectionMode === 'circle' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>RAIO</button>
              <button onClick={() => setAppState({ ...appState, selectionMode: 'polygon' }, true)} className={`flex-1 text-[10px] font-bold py-2.5 rounded-lg transition-all ${selectionMode === 'polygon' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>POLÍGONO</button>
            </div>
          </div>

          {selectionMode === 'polygon' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl space-y-4">
              <div className="flex items-center justify-between text-[10px] font-black text-blue-400 uppercase">
                <span>Engenharia de Mov. Terra</span>
                <Ruler size={14} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 uppercase">Cota Alvo (m)</label>
                  <input type="number" value={targetZ} onChange={(e) => setTargetZ(parseFloat(e.target.value))} className="w-full bg-slate-900 border border-white/5 rounded-lg py-2 px-3 text-xs text-blue-400 font-mono" />
                </div>
                <button onClick={handlePadAnalysis} className="mt-auto bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 text-[10px] font-black p-2 rounded-lg transition-all">ANALISAR PLATÔ</button>
              </div>
            </motion.div>
          )}

          <div className="mt-auto space-y-4">
            <motion.button whileHover={{ scale: 1.02 }} onClick={handleFetchAndAnalyze} disabled={isProcessing} className="w-full py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl flex items-center justify-center gap-3 font-black text-xs tracking-widest uppercase shadow-2xl shadow-blue-500/20">
              {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <TrendingUp size={20} />}
              {isProcessing ? 'PROCESSANDO...' : 'EXECUTAR AUDITORIA'}
            </motion.button>

            {osmData && (
              <div className="grid grid-cols-2 gap-4">
                <button onClick={handleDownloadDxf} className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl flex flex-col items-center justify-center gap-1 font-black text-[9px] uppercase transition-all shadow-lg group">
                  <Download size={18} className="group-hover:animate-bounce" /> DXF PREMIUM
                </button>
                <button className="py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl flex flex-col items-center justify-center gap-1 font-black text-[9px] uppercase transition-all shadow-lg border border-white/10 group">
                  <FileText size={18} className="group-hover:scale-110 transition-transform" /> MEMORIAL PDF
                </button>
              </div>
            )}
          </div>
        </motion.aside>

        <div className="flex-1 relative z-10">
          <MapSelector
            center={center}
            radius={radius}
            selectionMode={selectionMode}
            onLocationChange={(loc) => setAppState({ ...appState, center: loc }, true)}
            polygonPoints={polygon.map(p => [p.lat, p.lng])}
            onPolygonChange={(pts) => setAppState({ ...appState, polygon: pts.map(p => ({ lat: p[0], lng: p[1] })) }, true)}
            mapStyle={isDark ? 'dark' : 'vector'}
          />
          <FloatingLayerPanel settings={settings} onUpdateSettings={(s) => setAppState({ ...appState, settings: s }, true)} isDark={isDark} />
        </div>
      </main>
    </div>
  );
}

export default App;