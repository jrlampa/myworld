
import React, { useState, useEffect } from 'react';
import { Layers, Loader2, AlertCircle, Settings, Mountain, TrendingUp } from 'lucide-react';
import { OsmElement, AnalysisStats, TerrainGrid, GlobalState, AppSettings, GeoLocation, SelectionMode } from './types';
import { DEFAULT_LOCATION } from './constants';
import MapPreview from './components/MapPreview';
import Dashboard from './components/Dashboard';
import SettingsModal from './components/SettingsModal';
import HistoryControls from './components/HistoryControls';
import DxfLegend from './components/DxfLegend';
import SearchControl from './components/SearchControl';
import FloatingLayerPanel from './components/FloatingLayerPanel'; 
import ElevationProfile from './components/ElevationProfile';
import Toast, { ToastType } from './components/Toast';
import ProgressIndicator from './components/ProgressIndicator';
import { useUndoRedo } from './hooks/useUndoRedo';
import { generateElevationProfile } from './utils/geoMath';

import { fetchOsmData, fetchOsmDataPolygon } from './services/osmService';
import { generateDXF, calculateStats } from './services/dxfService';
import { findLocation, analyzeArea } from './services/geminiService';
import { fetchElevationGrid } from './services/elevationService';

function App() {
  const { 
    state: appState, 
    setState: setAppState, 
    undo, 
    redo, 
    canUndo, 
    canRedo
  } = useUndoRedo<GlobalState>({
    center: DEFAULT_LOCATION,
    radius: 500,
    selectionMode: 'radius',
    polygon: [],
    measurePath: [],
    settings: {
      enableAI: true,
      simplificationLevel: 'low',
      orthogonalize: true, 
      projection: 'local',
      theme: 'dark', 
      mapProvider: 'vector', 
      contourInterval: 5,
      layers: {
        buildings: true,
        roads: true,
        curbs: true, 
        nature: true,
        terrain: true,
        contours: false,
        slopeAnalysis: false,
        furniture: true,
        labels: true,
        dimensions: false, 
        grid: false
      },
      projectMetadata: {
        projectName: 'PROJETO OSM-01',
        companyName: 'ENG CORP LTDA',
        engineerName: 'ENG. RESPONSÁVEL',
        date: new Date().toLocaleDateString('pt-BR'),
        scale: 'N/A',
        revision: 'R00'
      }
    }
  }, 'osm-app-v11');

  const { center, radius, selectionMode, polygon, measurePath, settings } = appState;
  const isDark = settings.theme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  const [showSettings, setShowSettings] = useState(false);
  
  const [osmData, setOsmData] = useState<OsmElement[] | null>(null);
  const [terrainData, setTerrainData] = useState<TerrainGrid | null>(null);
  const [elevationProfileData, setElevationProfileData] = useState<{dist:number, elev:number}[]>([]);
  
  const [stats, setStats] = useState<AnalysisStats | null>(null);
  const [analysisText, setAnalysisText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Toast State
  const [toast, setToast] = useState<{message: string, type: ToastType} | null>(null);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
  };

  const updateSettings = (newSettings: AppSettings) => {
    setAppState({ ...appState, settings: newSettings }, true);
  };

  const handleMapClick = (newCenter: GeoLocation) => {
    setAppState({ ...appState, center: newCenter }, true);
    setOsmData(null);
    setTerrainData(null);
    setStats(null);
  };

  const handlePolygonChange = (newPolygon: GeoLocation[]) => {
    setAppState({ ...appState, polygon: newPolygon }, true);
    setOsmData(null);
  };

  const handleSelectionModeChange = (mode: SelectionMode) => {
    setAppState({ ...appState, selectionMode: mode, polygon: [], measurePath: [] }, true);
  };
  
  const handleMeasurePathChange = (path: GeoLocation[]) => {
      setAppState({ ...appState, measurePath: path }, false); 
      
      if (path.length === 2 && terrainData) {
          const profile = generateElevationProfile(path[0], path[1], terrainData);
          setElevationProfileData(profile);
      } else {
          setElevationProfileData([]);
      }
  };

  const handleRadiusChange = (r: number) => {
     setAppState({ ...appState, radius: r }, false); 
  };

  const handleClearPolygon = () => {
    setAppState({ ...appState, polygon: [] }, true);
  };

  const handleSaveProject = () => {
    const projectData = {
      state: appState,
      timestamp: new Date().toISOString(),
      version: "2.5.0"
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${settings.projectMetadata.projectName || 'projeto'}.osmpro`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Projeto salvo com sucesso!", 'success');
  };

  const handleLoadProject = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        if (data && data.state) {
          setAppState(data.state, true);
          setOsmData(null); 
          setTerrainData(null);
          setStats(null);
          setShowSettings(false);
          showToast("Projeto carregado. Execute a análise para atualizar dados.", 'info');
        } else {
          throw new Error("Formato de arquivo inválido.");
        }
      } catch (err) {
        showToast("Erro ao carregar projeto.", 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    
    const location = await findLocation(searchQuery, settings.enableAI);
    
    if (location) {
      setAppState({ ...appState, center: location }, true);
      setOsmData(null); 
      setTerrainData(null);
      setStats(null);
      showToast(`Local encontrado: ${location.label}`, 'success');
    } else {
      showToast("Não foi possível encontrar este local.", 'error');
    }
    setIsSearching(false);
  };

  const getEffectiveCenter = (): GeoLocation => {
    if (selectionMode === 'radius' || polygon.length === 0) return center;
    
    const sumLat = polygon.reduce((sum, p) => sum + p.lat, 0);
    const sumLng = polygon.reduce((sum, p) => sum + p.lng, 0);
    return {
      lat: sumLat / polygon.length,
      lng: sumLng / polygon.length,
      label: 'Centro do Polígono'
    };
  };

  const handleFetchAndAnalyze = async () => {
    setIsProcessing(true);
    setError(null);
    setAnalysisText(''); 
    setProgressValue(0);
    
    try {
      let data: OsmElement[] = [];
      const effectiveCenter = getEffectiveCenter();

      // STEP 1: OSM DATA
      setStatusMessage('Consultando API OpenStreetMap...');
      setProgressValue(10);
      
      if (selectionMode === 'radius') {
        data = await fetchOsmData(center.lat, center.lng, radius);
      } else {
        if (polygon.length < 3) throw new Error("Área inválida. Defina a área no mapa.");
        data = await fetchOsmDataPolygon(polygon);
      }
      setProgressValue(30);

      if (data.length === 0) {
        throw new Error("Nenhum dado encontrado. Tente ajustar a área.");
      }
      setOsmData(data);

      // STEP 2: TERRAIN
      setStatusMessage('Baixando malha topográfica...');
      setProgressValue(45);
      const polyArg = (selectionMode === 'polygon' || selectionMode === 'rectangle') ? polygon : undefined;
      const terrain = await fetchElevationGrid(effectiveCenter, radius, polyArg);
      setTerrainData(terrain);
      setProgressValue(70);

      // STEP 3: STATS & AUDIT
      setStatusMessage('Calculando estatísticas de engenharia...');
      await new Promise(r => setTimeout(r, 300)); // Small delay for UX
      const calculatedStats = calculateStats(data);
      setStats(calculatedStats);
      setProgressValue(85);

      // STEP 4: AI
      if (settings.enableAI) {
        setStatusMessage('Gerando análise do Consultor IA...');
        const auditPayload = {
             summary: {
                 buildings: calculatedStats.totalBuildings,
                 heightMax: calculatedStats.maxHeight,
                 avgHeight: calculatedStats.avgHeight
             },
             violations: calculatedStats.violations.map(v => v.message)
        };
        const text = await analyzeArea(auditPayload, center.label || "a área selecionada", true);
        setAnalysisText(text);
      } else {
        setAnalysisText("Análise de IA desativada.");
      }
      
      setProgressValue(100);
      showToast("Análise concluída com sucesso!", 'success');

    } catch (err: any) {
      setError(err.message || "Ocorreu um erro inesperado.");
      showToast(err.message || "Erro na análise.", 'error');
    } finally {
      setStatusMessage('');
      // Delay turning off processing to let user see 100%
      setTimeout(() => setIsProcessing(false), 1000);
    }
  };

  const handleDownloadDxf = async () => {
    if (!osmData) return;
    setIsDownloading(true);
    setProgressValue(0);
    setStatusMessage('Iniciando comunicação com servidor...');
    
    try {
      const effectiveCenter = getEffectiveCenter();
      
      // Pass the progress callback to the service
      const updateProgress = (pct: number, msg: string) => {
          setProgressValue(pct);
          setStatusMessage(msg);
      };

      const dxfBlob = await generateDXF(
          osmData, 
          effectiveCenter, 
          terrainData || undefined, 
          settings,
          updateProgress 
      );
      
      const url = URL.createObjectURL(dxfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${settings.projectMetadata.projectName || 'osm_export'}.dxf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast("Arquivo DXF gerado e baixado.", 'success');
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Falha ao gerar/baixar DXF do backend.");
      showToast(e.message || "Falha no processamento do DXF.", 'error');
    } finally {
      setTimeout(() => {
          setIsDownloading(false);
          setProgressValue(0);
      }, 2000);
    }
  };

  const handleDownloadGeoJSON = async () => {
    if (!osmData) return;
    setIsDownloading(true);
    setStatusMessage('Formatando GeoJSON...');
    setProgressValue(50);
    try {
      const response = await fetch('http://localhost:3000/api/geojson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elements: osmData, options: { layers: settings.layers } })
      });
      if (!response.ok) throw new Error('Failed');
      
      setProgressValue(100);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `osm_export_${center.lat.toFixed(4)}.geojson`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("GeoJSON baixado.", 'success');
    } catch (e) {
       showToast("Falha ao baixar GeoJSON.", 'error');
    } finally {
      setTimeout(() => {
          setIsDownloading(false);
          setProgressValue(0);
      }, 1000);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
            if (canRedo) redo();
        } else {
            if (canUndo) undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        if (canRedo) redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  useEffect(() => {
    if (center.lat === DEFAULT_LOCATION.lat && center.lng === DEFAULT_LOCATION.lng) {
        if (navigator.geolocation) {
           navigator.geolocation.getCurrentPosition((position) => {
             setAppState({
               ...appState,
               center: {
                 lat: position.coords.latitude,
                 lng: position.coords.longitude,
                 label: "Localização Atual"
               }
             }, false);
           }, (err) => {
             console.log("Geolocation permission denied, using default.");
           });
        }
    }
  }, []); 
  
  const isPolygonValid = (selectionMode === 'polygon' && polygon.length >= 3) || (selectionMode === 'rectangle' && polygon.length === 4);

  return (
    <div className={`flex flex-col h-screen w-full transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Toast Notification Container */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* Discrete Progress Indicator */}
      <ProgressIndicator 
         isVisible={isProcessing || isDownloading} 
         progress={progressValue}
         message={statusMessage}
      />

      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        selectionMode={selectionMode}
        onSelectionModeChange={handleSelectionModeChange}
        radius={radius}
        onRadiusChange={handleRadiusChange}
        polygon={polygon}
        onClearPolygon={handleClearPolygon}
        hasData={!!osmData}
        isDownloading={isDownloading}
        onExportDxf={handleDownloadDxf}
        onExportGeoJSON={handleDownloadGeoJSON}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
      />

      <header className={`h-16 border-b flex items-center justify-between px-6 shrink-0 transition-colors ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white/80'}`}>
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
             <Layers size={20} className="text-white" />
          </div>
          <h1 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>OSM to DXF <span className="text-blue-500 font-mono text-sm">2.5D Pro</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <HistoryControls 
            canUndo={canUndo} 
            canRedo={canRedo} 
            onUndo={undo} 
            onRedo={redo} 
          />
          <button 
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium transition-colors shadow-lg shadow-blue-500/20"
            title="Abrir Painel de Controle"
          >
            <Settings size={18} />
            <span className="hidden sm:inline">Configurações & Exportar</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        
        <aside className={`w-96 border-r flex flex-col p-6 gap-6 overflow-y-auto z-10 shadow-xl transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          
          <SearchControl 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleSearch={handleSearch}
            isSearching={isSearching}
            center={center}
          />

          <div className={`rounded-lg p-3 border space-y-2 ${isDark ? 'bg-slate-950/30 border-slate-800/50' : 'bg-slate-50 border-slate-200'}`}>
             <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Modo:</span>
                <span className={`font-medium capitalize ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                   {selectionMode === 'radius' ? 'Raio Circular' : selectionMode === 'measure' ? 'Medição de Perfil' : selectionMode === 'rectangle' ? 'Retângulo' : 'Polígono Livre'}
                </span>
             </div>
             {selectionMode === 'radius' && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Alcance:</span>
                  <span className={`font-mono ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{radius}m</span>
                </div>
             )}
             {(selectionMode === 'polygon' || selectionMode === 'rectangle') && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Vértices:</span>
                  <span className={`font-mono ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{polygon.length}</span>
                </div>
             )}
             
             {/* Mode Switcher */}
             <div className="flex gap-1 mt-2">
                 <button onClick={() => handleSelectionModeChange('radius')} className={`flex-1 text-[10px] py-1 border rounded ${selectionMode === 'radius' ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 text-slate-500'}`}>Raio</button>
                 <button onClick={() => handleSelectionModeChange('rectangle')} className={`flex-1 text-[10px] py-1 border rounded ${selectionMode === 'rectangle' ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 text-slate-500'}`}>Retângulo</button>
                 <button onClick={() => handleSelectionModeChange('measure')} title="Medir Terreno" className={`flex-none w-8 text-[10px] py-1 border rounded flex items-center justify-center ${selectionMode === 'measure' ? 'bg-green-600 border-green-600 text-white' : 'border-slate-700 text-slate-500'}`}><TrendingUp size={12}/></button>
             </div>
          </div>

          <div className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}></div>

          <div className="pt-2">
            <button
              onClick={handleFetchAndAnalyze}
              disabled={isProcessing || (selectionMode !== 'radius' && !isPolygonValid)}
              className={`w-full py-4 rounded-lg flex items-center justify-center gap-2 font-bold text-lg transition-all shadow-xl ${
                isProcessing || (selectionMode !== 'radius' && !isPolygonValid)
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Processando...
                </>
              ) : (
                <>
                  <Settings size={20} />
                  Analisar Área
                </>
              )}
            </button>
            {selectionMode === 'polygon' && polygon.length < 3 && (
               <p className="text-[10px] text-red-400 text-center mt-2">Defina pelo menos 3 pontos no mapa.</p>
            )}
            {selectionMode === 'rectangle' && polygon.length !== 4 && (
               <p className="text-[10px] text-red-400 text-center mt-2">Defina o retângulo (2 cliques).</p>
            )}
            {selectionMode === 'measure' && !terrainData && (
               <p className="text-[10px] text-yellow-400 text-center mt-2">Execute "Analisar Área" primeiro para habilitar medição.</p>
            )}
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-900/50 p-3 rounded-lg flex items-start gap-2 text-red-400 text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {osmData && stats && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4 mt-auto pb-4">
               <div className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
               <Dashboard stats={stats} analysisText={analysisText} />
               <DxfLegend />

               <div className={`p-3 rounded-lg flex items-center justify-between text-xs border ${isDark ? 'bg-slate-800/50 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  <div className="flex items-center gap-2">
                    <Mountain size={16} className={terrainData ? "text-purple-400" : "text-slate-500"} />
                    <span>Terreno: {terrainData ? 'Disponível' : 'N/A'}</span>
                  </div>
                  <button onClick={() => setShowSettings(true)} className="text-blue-500 hover:underline">
                    Ir para Exportação &rarr;
                  </button>
               </div>
            </div>
          )}

        </aside>

        <section className={`flex-1 relative p-4 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
          <MapPreview 
            center={center} 
            radius={radius} 
            mode={selectionMode}
            polygon={polygon}
            terrainData={terrainData}
            theme={settings.theme}
            mapProvider={settings.mapProvider}
            violations={stats?.violations} 
            onCenterChange={handleMapClick} 
            onPolygonChange={handlePolygonChange}
            measurePath={measurePath}
            onMeasurePathChange={handleMeasurePathChange}
          />
          
          <FloatingLayerPanel 
             settings={settings}
             onUpdateSettings={updateSettings}
             isDark={isDark}
          />

          <ElevationProfile 
              data={elevationProfileData} 
              onClose={() => { setElevationProfileData([]); handleSelectionModeChange('radius'); }}
              isDark={isDark}
          />
          
           <div className={`absolute bottom-4 left-4 z-[400] flex gap-2 pointer-events-none`}>
              <div className={`px-2 py-1 text-[10px] rounded border backdrop-blur flex items-center gap-2 ${isDark ? 'bg-slate-900/80 border-slate-700 text-slate-400' : 'bg-white/80 border-slate-200 text-slate-600'}`}>
                 <span className="w-2 h-2 rounded-full bg-green-500"></span>
                 PRO MODE ACTIVE
              </div>
              {stats && (
                 <div className={`px-2 py-1 text-[10px] rounded border backdrop-blur ${isDark ? 'bg-slate-900/80 border-slate-700 text-slate-400' : 'bg-white/80 border-slate-200 text-slate-600'}`}>
                    OBJS: {stats.totalBuildings + stats.totalRoads}
                 </div>
              )}
           </div>
        </section>

      </main>
    </div>
  );
}

export default App;
