import React, { useState, useEffect } from 'react';
import { GlobalState, AppSettings, GeoLocation, SelectionMode } from './types';
import { DEFAULT_LOCATION } from './constants';
import AppHeader from './components/AppHeader';
import AppSidebar from './components/AppSidebar';
import MapSelector from './components/MapSelector';
import SettingsModal from './components/SettingsModal';
import FloatingLayerPanel from './components/FloatingLayerPanel';
import ElevationProfile from './components/ElevationProfile';
import Toast, { ToastType } from './components/Toast';
import ProgressIndicator from './components/ProgressIndicator';
import LandingPage from './components/LandingPage';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useOsmEngine } from './hooks/useOsmEngine';
import { useSearch } from './hooks/useSearch';
import { useDxfExport } from './hooks/useDxfExport';
import { useKmlImport } from './hooks/useKmlImport';
import { useFileOperations } from './hooks/useFileOperations';
import { useElevationProfile } from './hooks/useElevationProfile';
import { AnimatePresence } from 'framer-motion';

function App() {
  const [showLanding, setShowLanding] = useState(true);

  const {
    state: appState,
    setState: setAppState,
    undo,
    redo,
    canUndo,
    canRedo,
    saveSnapshot
  } = useUndoRedo<GlobalState>({
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
        companyName: 'ENG CORP',
        engineerName: 'ENG. RESPONSÁVEL',
        date: new Date().toLocaleDateString('pt-BR'),
        scale: 'N/A',
        revision: 'R00'
      }
    }
  });

  const { center, radius, selectionMode, polygon, measurePath, settings } = appState;
  const isDark = settings.theme === 'dark';

  const {
    isProcessing,
    progressValue,
    statusMessage,
    osmData,
    terrainData,
    stats,
    analysisText,
    error,
    runAnalysis,
    clearData,
  } = useOsmEngine();

  const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const showToast = (message: string, type: ToastType) => setToast({ message, type });

  const { searchQuery, setSearchQuery, isSearching, handleSearch } = useSearch({
    onLocationFound: (location) => {
      setAppState({ ...appState, center: location }, true);
      clearData();
      showToast(`Localização encontrada: ${location.label}`, 'success');
    },
    onError: (message) => showToast(message, 'error')
  });

  const { downloadDxf, isDownloading, jobId, jobStatus, jobProgress } = useDxfExport({
    onSuccess: (message) => showToast(message, 'success'),
    onError: (message) => showToast(message, 'error')
  });

  const { importKml } = useKmlImport({
    onImportSuccess: (geoPoints, filename) => {
      setAppState({ ...appState, selectionMode: 'polygon', polygon: geoPoints, center: { ...geoPoints[0], label: filename } }, true);
      clearData();
      showToast('KML Importado', 'success');
    },
    onError: (message) => showToast(message, 'error')
  });

  const { saveProject, loadProject } = useFileOperations({
    appState,
    setAppState,
    onSuccess: (message) => showToast(message, 'success'),
    onError: (message) => showToast(message, 'error')
  });

  const { profileData: elevationProfileData, loadProfile: loadElevationProfile, clearProfile } = useElevationProfile();

  const updateSettings = (newSettings: AppSettings) => setAppState({ ...appState, settings: newSettings }, true);
  const handleMapClick = (newCenter: GeoLocation) => { setAppState({ ...appState, center: newCenter }, true); clearData(); };
  const handleSelectionModeChange = (mode: SelectionMode) => setAppState({ ...appState, selectionMode: mode, polygon: [], measurePath: [] }, true);

  const handleMeasurePathChange = async (path: [number, number][]) => {
    const geoPath = path.map(p => ({ lat: p[0], lng: p[1] }));
    setAppState({ ...appState, measurePath: geoPath }, false);
    if (geoPath.length === 2) {
      await loadElevationProfile(geoPath[0], geoPath[1]);
    } else {
      clearProfile();
    }
  };

  const handleFetchAndAnalyze = async () => {
    const success = await runAnalysis(center, radius, settings.enableAI);
    if (success) showToast('Análise concluída!', 'success');
    else showToast('Análise falhou. Verifique os logs do backend.', 'error');
  };

  const handleDownloadDxf = async () => {
    if (!osmData) return;
    await downloadDxf(center, radius, selectionMode, polygon, settings.layers, settings.projection);
  };

  const handleKmlDrop = async (file: File) => { await importKml(file); };

  // Localização atual ao montar (apenas se usando localização padrão)
  useEffect(() => {
    if (center.lat === DEFAULT_LOCATION.lat && center.lng === DEFAULT_LOCATION.lng && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setAppState({ ...appState, center: { lat: position.coords.latitude, lng: position.coords.longitude, label: 'Localização Atual' } }, false);
      });
    }
  }, []);

  const isPolygonValid = selectionMode === 'polygon' && polygon.length >= 3;
  const polygonPoints = React.useMemo(() => polygon.map(p => [p.lat, p.lng] as [number, number]), [polygon]);
  const measurePathPoints = React.useMemo(() => measurePath.map(p => [p.lat, p.lng] as [number, number]), [measurePath]);

  const showDxfProgress = isDownloading || !!jobId;
  const dxfProgressValue = Math.max(0, Math.min(100, Math.round(jobProgress)));
  const dxfProgressLabel = jobStatus === 'queued' || jobStatus === 'waiting'
    ? 'A gerar DXF: na fila...'
    : `A gerar DXF: ${dxfProgressValue}%...`;

  if (showLanding) {
    return <LandingPage onEnter={() => setShowLanding(false)} />;
  }

  return (
    <div className={`flex flex-col h-screen w-full font-sans transition-colors duration-500 overflow-hidden ${isDark ? 'bg-[#020617] text-slate-200' : 'bg-slate-50 text-slate-900'}`}>

      <AnimatePresence>
        {toast && (
          <Toast key="toast" message={toast.message} type={toast.type} onClose={() => setToast(null)} duration={toast.type === 'error' ? 8000 : 4000} />
        )}
      </AnimatePresence>

      <ProgressIndicator isVisible={isProcessing || isDownloading} progress={progressValue} message={statusMessage} />

      {showDxfProgress && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-slate-100 shadow-lg">
          {dxfProgressLabel}
        </div>
      )}

      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            key="settings"
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            settings={settings}
            onUpdateSettings={updateSettings}
            selectionMode={selectionMode}
            onSelectionModeChange={handleSelectionModeChange}
            radius={radius}
            onRadiusChange={(r) => setAppState({ ...appState, radius: r }, false)}
            polygon={polygon}
            onClearPolygon={() => setAppState({ ...appState, polygon: [] }, true)}
            hasData={!!osmData}
            isDownloading={isDownloading}
            onExportDxf={handleDownloadDxf}
            onExportGeoJSON={() => showToast('Exportação GeoJSON não implementada no cliente.', 'info')}
            onSaveProject={saveProject}
            onLoadProject={loadProject}
          />
        )}
      </AnimatePresence>

      <AppHeader
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onOpenSettings={() => setShowSettings(true)}
        isDark={isDark}
      />

      <main className="flex-1 flex overflow-hidden relative">
        <AppSidebar
          isDark={isDark}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isSearching={isSearching}
          handleSearch={handleSearch}
          center={center}
          selectionMode={selectionMode}
          onSelectionModeChange={handleSelectionModeChange}
          radius={radius}
          onRadiusChange={(r) => setAppState({ ...appState, radius: r }, false)}
          onSaveSnapshot={saveSnapshot}
          isPolygonValid={isPolygonValid}
          isProcessing={isProcessing}
          onFetchAndAnalyze={handleFetchAndAnalyze}
          error={error}
          osmData={osmData}
          stats={stats}
          analysisText={analysisText}
          terrainData={terrainData}
          isDownloading={isDownloading}
          onDownloadDxf={handleDownloadDxf}
          onToast={showToast}
        />

        {/* Área de Visualização do Mapa */}
        <div className="flex-1 relative z-10">
          <MapSelector
            center={center}
            radius={radius}
            selectionMode={selectionMode}
            polygonPoints={polygonPoints}
            onLocationChange={handleMapClick}
            onPolygonChange={(points) => {
              const geoPoints = points.map(p => ({ lat: p[0], lng: p[1] }));
              setAppState({ ...appState, polygon: geoPoints }, true);
            }}
            measurePath={measurePathPoints}
            onMeasurePathChange={handleMeasurePathChange}
            onKmlDrop={handleKmlDrop}
            mapStyle={settings.mapProvider === 'satellite' ? 'satellite' : 'dark'}
          />

          <FloatingLayerPanel settings={settings} onUpdateSettings={updateSettings} isDark={isDark} />

          <AnimatePresence>
            {elevationProfileData.length > 0 && (
              <ElevationProfile
                data={elevationProfileData}
                onClose={() => { clearProfile(); handleSelectionModeChange('circle'); }}
                isDark={isDark}
              />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default App;
