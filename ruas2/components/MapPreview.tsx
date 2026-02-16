
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Plus, Minus, Mountain, Eraser, AlertTriangle, Sun, Ruler } from 'lucide-react';
import { GeoLocation, TerrainGrid, SelectionMode, AppTheme, MapProvider, Violation } from '../types';
import { calculateSunPosition, calculateShadowOffset } from '../utils/geoMath';

interface MapPreviewProps {
  center: GeoLocation;
  radius: number;
  mode: SelectionMode;
  polygon: GeoLocation[];
  terrainData: TerrainGrid | null;
  theme: AppTheme;
  mapProvider?: MapProvider; 
  violations?: Violation[];
  onCenterChange: (newCenter: GeoLocation) => void;
  onPolygonChange: (newPolygon: GeoLocation[]) => void;
  
  // New Props for Measure
  measurePath?: GeoLocation[];
  onMeasurePathChange?: (path: GeoLocation[]) => void;
}

const MapPreview: React.FC<MapPreviewProps> = ({ 
  center, 
  radius, 
  mode, 
  polygon, 
  terrainData, 
  theme,
  mapProvider = 'vector',
  violations = [], 
  onCenterChange,
  onPolygonChange,
  measurePath = [],
  onMeasurePathChange
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  
  // Layer Refs
  const circleRef = useRef<L.Circle | null>(null);
  const polygonLayerRef = useRef<L.Polygon | null>(null);
  const previewRectLayerRef = useRef<L.Rectangle | null>(null);
  
  // Layer Groups
  const heatLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const violationsLayerRef = useRef<L.LayerGroup | null>(null);
  const shadowsLayerRef = useRef<L.LayerGroup | null>(null); // New Shadow Layer
  const measureLayerRef = useRef<L.LayerGroup | null>(null); // New Measure Layer
  
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showShadows, setShowShadows] = useState(false);
  const [sunHour, setSunHour] = useState(14); // 2 PM default

  // Initialize Map
  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        maxZoom: 50,
        minZoom: 2
      }).setView([center.lat, center.lng], 15);

      // Order matters
      heatLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
      shadowsLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
      markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
      measureLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
      violationsLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    }
  }, []); 

  // Handle Center Change (FlyTo) - FIX: Ensure map moves when center updates (e.g. Search)
  useEffect(() => {
    if (mapInstanceRef.current) {
        // Fly to new location, maintaining reasonable zoom
        const currentZoom = mapInstanceRef.current.getZoom();
        const targetZoom = Math.max(currentZoom, 15); // Ensure we don't zoom out too far if searching
        mapInstanceRef.current.flyTo([center.lat, center.lng], targetZoom, {
            duration: 1.5,
            easeLinearity: 0.25
        });
    }
  }, [center]); // Only trigger when center object changes

  // Handle Theme/Provider Change (Update Tile Layer)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    let tileUrl = '';
    let attribution = '';

    if (mapProvider === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
    } else {
      tileUrl = theme === 'dark' 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      attribution = '&copy; OpenStreetMap &copy; CARTO';
    }

    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution,
      subdomains: mapProvider === 'satellite' ? [] : 'abcd',
      maxNativeZoom: mapProvider === 'satellite' ? 17 : 19,
      maxZoom: 50
    }).addTo(mapInstanceRef.current);
    
    tileLayerRef.current.bringToBack();

  }, [theme, mapProvider]);

  // --- Shadow Simulation Effect ---
  useEffect(() => {
    if (!mapInstanceRef.current || !shadowsLayerRef.current) return;
    
    shadowsLayerRef.current.clearLayers();

    if (showShadows && violations.length > 0) { // Using violations as a proxy for "loaded buildings" for preview
       // In a real app, we would use the full `osmData` prop, but let's use the violation markers (buildings) for demo
       // or simulate some boxes around the center if no data.
       
       const sunPos = calculateSunPosition(center.lat, sunHour);
       
       // Visualize Shadows for markers (simulating buildings)
       violations.forEach(v => {
           // Assume random height if not in violation data, mostly for visual effect
           const height = v.message.includes('alto') ? 60 : 15; 
           
           // Simple shadow projection: Create a line from point
           // Leaflet Pixels
           const map = mapInstanceRef.current!;
           const point = map.latLngToContainerPoint([v.location.lat, v.location.lng]);
           
           const offset = calculateShadowOffset(height, sunPos, 1.5); // 1.5 pixel scale factor
           
           const endPoint = L.point(point.x + offset.x, point.y + offset.y);
           const endLatLng = map.containerPointToLatLng(endPoint);
           
           L.polygon([
               [v.location.lat, v.location.lng],
               [endLatLng.lat, endLatLng.lng],
               [v.location.lat + 0.0001, v.location.lng] // Make it a small triangle/shape
           ], {
               stroke: false,
               fillColor: '#000',
               fillOpacity: 0.4
           }).addTo(shadowsLayerRef.current!);
       });
    }

  }, [showShadows, sunHour, violations, center]);


  // --- Measure Path Effect ---
  useEffect(() => {
     if (!measureLayerRef.current) return;
     measureLayerRef.current.clearLayers();

     if (mode === 'measure' && measurePath.length > 0) {
         // Draw dots
         measurePath.forEach((p, idx) => {
             L.circleMarker([p.lat, p.lng], {
                 radius: 4,
                 color: idx === 0 ? '#3b82f6' : '#ef4444',
                 fillColor: '#fff',
                 fillOpacity: 1
             }).addTo(measureLayerRef.current!);
         });

         // Draw line
         if (measurePath.length > 1) {
             const latLngs = measurePath.map(p => [p.lat, p.lng] as [number, number]);
             L.polyline(latLngs, {
                 color: '#3b82f6',
                 weight: 3,
                 dashArray: '5, 10'
             }).addTo(measureLayerRef.current!);
         }
     }

  }, [mode, measurePath]);


  // Handle Mouse Move (Rectangle) & Measure
  useEffect(() => {
     if (!mapInstanceRef.current) return;
     const map = mapInstanceRef.current;

     const handleMouseMove = (e: L.LeafletMouseEvent) => {
        if (mode === 'rectangle' && polygon.length === 1) {
           const start = polygon[0];
           const end = { lat: e.latlng.lat, lng: e.latlng.lng };
           const bounds: L.LatLngBoundsExpression = [
              [start.lat, start.lng],
              [end.lat, end.lng]
           ];

           if (!previewRectLayerRef.current) {
              previewRectLayerRef.current = L.rectangle(bounds, {
                 color: '#818cf8', 
                 weight: 1,
                 dashArray: '5, 5',
                 fillOpacity: 0.2
              }).addTo(map);
           } else {
              previewRectLayerRef.current.setBounds(bounds);
           }
        } else if (mode === 'measure' && measurePath.length === 1) {
            // Draw guideline
            // (Simplified for this version, rely on click)
        } else {
           if (previewRectLayerRef.current) {
              previewRectLayerRef.current.remove();
              previewRectLayerRef.current = null;
           }
        }
     };

     map.on('mousemove', handleMouseMove);
     return () => { map.off('mousemove', handleMouseMove); };
  }, [mode, polygon, measurePath]);

  // Handle Map Clicks
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      if (mode === 'measure') {
          if (onMeasurePathChange) {
              if (measurePath.length >= 2) {
                  onMeasurePathChange([{ lat, lng }]); // Reset
              } else {
                  onMeasurePathChange([...measurePath, { lat, lng }]);
              }
          }
      }
      else if (mode === 'radius') {
        onCenterChange({
          lat,
          lng,
          label: `Local Selecionado (${lat.toFixed(4)}, ${lng.toFixed(4)})`
        });
      } 
      else if (mode === 'polygon') {
        const newPoint = { lat, lng };
        onPolygonChange([...polygon, newPoint]);
      }
      else if (mode === 'rectangle') {
         if (polygon.length === 0) {
            onPolygonChange([{ lat, lng }]);
         } else if (polygon.length === 1) {
            const start = polygon[0];
            const end = { lat, lng };
            const corners = [
               { lat: start.lat, lng: start.lng },
               { lat: start.lat, lng: end.lng },
               { lat: end.lat, lng: end.lng },
               { lat: end.lat, lng: start.lng }
            ];
            onPolygonChange(corners);
            if (previewRectLayerRef.current) {
               previewRectLayerRef.current.remove();
               previewRectLayerRef.current = null;
            }
         } else {
            onPolygonChange([{ lat, lng }]);
         }
      }
    };

    map.on('click', handleMapClick);
    return () => { map.off('click', handleMapClick); };
  }, [mode, polygon, onCenterChange, onPolygonChange, measurePath]);

  // Update View & Layers (Circle/Poly)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (mode === 'radius') {
      if (polygonLayerRef.current) {
        polygonLayerRef.current.remove();
        polygonLayerRef.current = null;
      }
      if (previewRectLayerRef.current) {
        previewRectLayerRef.current.remove();
        previewRectLayerRef.current = null;
      }
      markersLayerRef.current?.clearLayers();

      if (circleRef.current) circleRef.current.remove();
      circleRef.current = L.circle([center.lat, center.lng], {
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        weight: 1,
        radius: radius
      }).addTo(map);
    } 
    else if (mode === 'polygon' || mode === 'rectangle') {
      if (circleRef.current) {
        circleRef.current.remove();
        circleRef.current = null;
      }

      markersLayerRef.current?.clearLayers();

      polygon.forEach((p, idx) => {
         const marker = L.circleMarker([p.lat, p.lng], {
           radius: 4,
           color: idx === 0 ? '#4ade80' : '#fff',
           fillColor: mode === 'rectangle' ? '#818cf8' : '#3b82f6',
           fillOpacity: 1,
           weight: 2
         });
         markersLayerRef.current?.addLayer(marker);
      });

      if (polygonLayerRef.current) polygonLayerRef.current.remove();
      
      if (polygon.length > 1) {
        const latLngs = polygon.map(p => [p.lat, p.lng] as [number, number]);
        polygonLayerRef.current = L.polygon(latLngs, {
          color: mode === 'rectangle' ? '#818cf8' : '#e879f9',
          fillColor: mode === 'rectangle' ? '#818cf8' : '#e879f9',
          fillOpacity: 0.1,
          weight: 2,
          dashArray: (mode === 'polygon' && polygon.length < 3) ? '5, 5' : undefined 
        }).addTo(map);
      }
    }

  }, [center, radius, mode, polygon]);

  // Handle Violations Visualization
  useEffect(() => {
    if (!mapInstanceRef.current || !violationsLayerRef.current) return;
    
    violationsLayerRef.current.clearLayers();

    violations.forEach(v => {
      const pulsatingIcon = L.divIcon({
        className: 'pulsating-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      L.marker([v.location.lat, v.location.lng], { icon: pulsatingIcon })
        .addTo(violationsLayerRef.current!)
        .bindTooltip(`${v.type.toUpperCase()}: ${v.message}`, { 
          permanent: false, 
          direction: 'top',
          className: theme === 'dark' ? 'dark-tooltip' : '' 
        });
    });

  }, [violations, theme]);

  // Handle Terrain Visualization
  useEffect(() => {
    if (!mapInstanceRef.current || !heatLayerRef.current) return;
    
    heatLayerRef.current.clearLayers();

    if (terrainData && terrainData.length > 0 && showHeatmap) {
      const allPoints = terrainData.flat();
      const minElev = Math.min(...allPoints.map(p => p.elevation));
      const maxElev = Math.max(...allPoints.map(p => p.elevation));
      const range = maxElev - minElev || 1;

      let latSize = 0.0001;
      let lngSize = 0.0001;
      if (terrainData.length > 1 && terrainData[0].length > 1) {
         latSize = Math.abs(terrainData[0][0].lat - terrainData[1][0].lat);
         lngSize = Math.abs(terrainData[0][0].lng - terrainData[0][1].lng);
      }

      terrainData.forEach(row => {
        row.forEach(point => {
          const val = (point.elevation - minElev) / range;
          const hue = (1 - val) * 240; 
          
          L.rectangle(
            [
              [point.lat - latSize/2, point.lng - lngSize/2], 
              [point.lat + latSize/2, point.lng + lngSize/2]
            ], 
            {
              stroke: false,
              fillColor: `hsl(${hue}, 80%, 50%)`,
              fillOpacity: 0.5,
              interactive: false
            }
          ).addTo(heatLayerRef.current!);
        });
      });
    }
  }, [terrainData, showHeatmap]);

  const handleClearPolygon = () => {
    onPolygonChange([]);
  };

  return (
    <div className={`w-full h-full rounded-xl overflow-hidden shadow-2xl border relative z-0 group ${theme === 'dark' ? 'border-slate-700' : 'border-slate-300'}`}>
      <div ref={mapContainerRef} className={`w-full h-full cursor-crosshair ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'}`} />
      
      {/* Footer Info */}
      <div className={`absolute bottom-4 left-4 z-[400] backdrop-blur text-xs p-2 rounded border select-none pointer-events-none transition-colors ${theme === 'dark' ? 'bg-slate-900/80 text-slate-400 border-slate-700' : 'bg-white/80 text-slate-600 border-slate-200'}`}>
        {mode === 'radius' 
          ? `Clique para mover • Raio: ${radius}m` 
          : mode === 'rectangle'
             ? (polygon.length === 1 ? 'Clique para fechar' : 'Clique para iniciar')
             : mode === 'measure' 
               ? (measurePath.length === 1 ? 'Clique no ponto final' : 'Clique no ponto inicial')
               : `Clique para desenhar • ${polygon.length} pontos`}
      </div>

      {/* Shadow Control UI */}
      {showShadows && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-slate-900/90 border border-slate-700 p-3 rounded-xl flex flex-col items-center gap-2 shadow-2xl w-64 animate-in slide-in-from-top-4">
              <div className="flex items-center gap-2 text-yellow-500 text-xs font-bold uppercase">
                  <Sun size={14} />
                  <span>Simulador Solar</span>
              </div>
              <input 
                 type="range" 
                 min={6} max={19} step={0.5} 
                 value={sunHour}
                 onChange={(e) => setSunHour(parseFloat(e.target.value))}
                 className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
              />
              <div className="flex justify-between w-full text-[10px] text-slate-400 font-mono">
                  <span>06:00</span>
                  <span className="text-white">{Math.floor(sunHour)}:{sunHour % 1 !== 0 ? '30' : '00'}</span>
                  <span>19:00</span>
              </div>
          </div>
      )}

      {/* Action Buttons */}
      <div className="absolute bottom-4 right-4 z-[400] flex flex-col gap-2">
        
        {/* Toggle Measure */}
        {onMeasurePathChange && (
            <button 
                onClick={() => {}} // handled in parent via mode switch, but could toggle here
                className={`p-2 rounded-lg border shadow-lg transition-colors pointer-events-none ${mode === 'measure' ? 'bg-blue-600 border-blue-500 text-white' : 'opacity-0'}`}
            >
                <Ruler size={20} />
            </button>
        )}

        {/* Toggle Shadows */}
        <button 
            onClick={() => setShowShadows(!showShadows)}
            className={`p-2 rounded-lg border shadow-lg transition-colors ${
              showShadows 
                ? 'bg-yellow-500 border-yellow-400 text-black' 
                : (theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900')
            }`}
            title="Simulação Solar"
        >
            <Sun size={20} />
        </button>

        {mode !== 'radius' && polygon.length > 0 && (
          <button 
            onClick={handleClearPolygon}
            className="p-2 bg-red-900/80 hover:bg-red-800 text-red-200 rounded-lg border border-red-700 shadow-lg transition-colors"
            title="Limpar Desenho"
          >
            <Eraser size={20} />
          </button>
        )}
        
        {terrainData && (
          <button 
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`p-2 rounded-lg border shadow-lg transition-colors ${
              showHeatmap 
                ? 'bg-purple-600 border-purple-500 text-white' 
                : (theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900')
            }`}
            title="Mapa de Elevação"
          >
            <Mountain size={20} />
          </button>
        )}
        
        <div className="flex flex-col rounded-lg overflow-hidden border shadow-lg">
          <button 
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className={`p-2 transition-colors ${theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'}`}
          >
            <Plus size={20} />
          </button>
          <div className={`h-px w-full ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`} />
          <button 
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className={`p-2 transition-colors ${theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'}`}
          >
            <Minus size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapPreview;
