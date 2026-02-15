import { useState, useEffect } from 'react';
import MapSelector from './components/MapSelector';
import ControlPanel from './components/ControlPanel';
import SearchBar from './components/SearchBar';
import SettingsModal from './components/SettingsModal';
import Dashboard from './components/Dashboard';
import ResponseModal from './components/ResponseModal';
import Toast from './components/Toast';
import usePersistentState from './hooks/usePersistentState';
import { useOsmEngine } from './hooks/useOsmEngine';
import { GroqService } from './services/groqService';
import './App.css';

function App() {
  // Navigation State
  const [activeView, setActiveView] = useState<'map' | 'dashboard'>('map');

  // UI State (Persisted)
  const [lat, setLat] = usePersistentState<number>('osm_lat', -23.5505);
  const [lon, setLon] = usePersistentState<number>('osm_lon', -46.6333);
  const [radius, setRadius] = usePersistentState<number>('osm_radius', 500);
  const [outputName, setOutputName] = usePersistentState<string>('osm_output', 'output.dxf');
  const [layers, setLayers] = usePersistentState('osm_layers', {
    buildings: true,
    roads: true,
    trees: true,
    amenities: true,
    terrain: false,
    streetWidths: true,
    highResContours: false,
    furniture: false
  });
  const [crs, setCrs] = usePersistentState<string>('osm_crs', 'auto');
  const [exportFormat, setExportFormat] = usePersistentState<string>('osm_format', 'dxf');
  const [selectionMode, setSelectionMode] = usePersistentState<'circle' | 'polygon'>('osm_selection_mode', 'circle');
  const [polygonPoints, setPolygonPoints] = usePersistentState<[number, number][]>('osm_polygon_points', []);
  const [mapStyle, setMapStyle] = usePersistentState<string>('osm_map_style', 'osm');
  const [showAnalysis, setShowAnalysis] = usePersistentState<boolean>('osm_show_analysis', false);
  const [clientName, setClientName] = usePersistentState<string>('osm_client_name', 'CLIENTE PADRÃO');
  const [projectId, setProjectId] = usePersistentState<string>('osm_project_id', 'PROJETO URBANISTICO');

  // UI State (Transient)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [aiAuditResult, setAiAuditResult] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  // Engine Logic (IPC)
  const { isGenerating, logs, geojsonData, generateDxf, addLog } = useOsmEngine();

  // Watch logs for toast triggers
  useEffect(() => {
    if (logs.length > 0) {
      const lastLog = logs[logs.length - 1];
      if (lastLog.status === 'success') {
        setToast({ message: lastLog.message, type: 'success' });
      } else if (lastLog.status === 'error') {
        setToast({ message: lastLog.message, type: 'error' });
      }
    }
  }, [logs]);

  // Derive Analytics Data (Thin Client - Data provided by Backend)
  const getAnalyticsData = () => {
    if (!geojsonData || !geojsonData.features) return null;

    let stats = {
      buildings: 0,
      roads: 0,
      poles: 0,
      trees: 0,
      totalArea: 0,
      totalLength: 0,
      violations: (geojsonData as any).audit_summary?.violations || 0,
      violations_list: (geojsonData as any).audit_summary?.violations_list || [],
      coverageScore: (geojsonData as any).audit_summary?.coverageScore || 0
    };

    const fc = geojsonData as any;

    // Basic Stats loop (keep lightweight)
    fc.features.forEach((f: any) => {
      if (f.properties?.is_analysis) return; // Skip analysis layers for basic counts

      const type = f.properties.feature_type || '';
      if (type === 'building') {
        stats.buildings++;
        stats.totalArea += f.properties.area || 0;
      } else if (type === 'highway') {
        stats.roads++;
        stats.totalLength += f.properties.length || 0;
      } else if (f.properties.power || f.properties.amenity === 'vending_machine') {
        stats.poles++;
      } else if (f.properties.natural === 'tree') {
        stats.trees++;
      }
    });

    return stats;
  };

  const handleGenerate = () => {
    if (selectionMode === 'circle' && radius > 3000) {
      setToast({ message: "Radius limited to 3km for stability.", type: 'warning' });
      return;
    }
    if (selectionMode === 'polygon' && polygonPoints.length < 3) {
      setToast({ message: "Draw at least 3 points for a polygon area.", type: 'warning' });
      return;
    }

    generateDxf({
      lat,
      lon,
      radius,
      outputName,
      layers,
      crs,
      exportFormat,
      selectionMode,
      polygon: selectionMode === 'polygon' ? polygonPoints : undefined,
      clientName,
      projectId
    });
  };

  const handleAskAI = async () => {
    const stats = getAnalyticsData();
    if (!stats) return;

    setToast({ message: "Connecting to AI Auditor...", type: 'info' });
    try {
      const analysis = await GroqService.analyzeData(stats);
      setAiAuditResult(analysis);
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const handleKmlDrop = async (filePath: string) => {
    try {
      addLog({ status: 'info', message: `Importing area from KML...` });
      // @ts-ignore
      const result = await window.ipcRenderer.invoke('parse-kml-file', filePath);

      if (result.success && result.points && result.points.length > 0) {
        setPolygonPoints(result.points);
        setSelectionMode('polygon');
        // Center map on first point
        setLat(result.points[0][0]);
        setLon(result.points[0][1]);
        setToast({ message: `Imported ${result.points.length} points from KML area.`, type: 'success' });
        addLog({ status: 'success', message: `KML Import successful: ${result.points.length} points.` });
      } else {
        setToast({ message: result.error || "Failed to parse KML.", type: 'error' });
      }
    } catch (error: any) {
      setToast({ message: `KML Import error: ${error.message}`, type: 'error' });
    }
  };

  return (
    <div className='App app-container'>
      {/* Sidebar Control Panel */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h1 className="app-title">
            OSM to CAD
          </h1>
          <p className="app-subtitle">
            v1.5.0 | DXF Generator
          </p>

          <SearchBar onSelectLocation={(newLat, newLon) => {
            setLat(newLat);
            setLon(newLon);
          }} />

          <div className="view-toggle glass">
            <button
              className={activeView === 'map' ? 'active' : ''}
              onClick={() => setActiveView('map')}
            >
              🗺️ Map View
            </button>
            <button
              className={activeView === 'dashboard' ? 'active' : ''}
              onClick={() => setActiveView('dashboard')}
            >
              📊 Analytics
            </button>
          </div>
        </div>
        <ControlPanel
          radius={radius}
          onRadiusChange={setRadius}
          outputName={outputName}
          onOutputNameChange={setOutputName}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          logs={logs}
          onOpenSettings={() => setIsSettingsOpen(true)}
          selectionMode={selectionMode}
          onSelectionModeChange={setSelectionMode}
          onClearPolygon={() => setPolygonPoints([])}
          onUndoPolygon={() => setPolygonPoints(polygonPoints.slice(0, -1))}
          polygonPointsCount={polygonPoints.length}
          exportFormat={exportFormat}
        />
      </div>

      {/* Main Content Area */}
      <div className="main-viewport">
        {activeView === 'map' ? (
          <div className="map-area">
            <MapSelector
              lat={lat}
              lon={lon}
              radius={radius}
              selectionMode={selectionMode}
              polygonPoints={polygonPoints}
              onLocationChange={(newLat, newLon) => {
                setLat(newLat);
                setLon(newLon);
              }}
              onPolygonChange={setPolygonPoints}
              onKmlDrop={handleKmlDrop}
              mapStyle={mapStyle}
              onMapStyleChange={setMapStyle}
              showAnalysis={showAnalysis}
              onShowAnalysisChange={setShowAnalysis}
              geojson={geojsonData}
            />
            <div className="glass overlay-info">
              Lat: {lat.toFixed(4)} | Lon: {lon.toFixed(4)}
            </div>
          </div>
        ) : (
          <Dashboard
            data={getAnalyticsData()}
            onAskAI={handleAskAI}
          />
        )}
      </div>

      {/* Modals & Overlays */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        layers={layers}
        onLayersChange={setLayers}
        crs={crs}
        onCrsChange={setCrs}
        exportFormat={exportFormat}
        onExportFormatChange={setExportFormat}
        showAnalysis={showAnalysis}
        onShowAnalysisChange={setShowAnalysis}
        clientName={clientName}
        onClientNameChange={setClientName}
        projectId={projectId}
        onProjectIdChange={setProjectId}
      />

      <ResponseModal
        isOpen={!!aiAuditResult}
        onClose={() => setAiAuditResult(null)}
        title="AI Engineering Audit"
        content={aiAuditResult || ""}
      />

      {toast && (
        <div className="toast-container">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}
    </div>
  );
}

export default App;
