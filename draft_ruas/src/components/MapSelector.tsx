import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, GeoJSON, Polygon, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { GeoJsonObject, FeatureCollection, Feature } from 'geojson';

// Fix for default marker icon in React Leaflet
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapSelectorProps {
  lat: number;
  lon: number;
  radius: number;
  selectionMode: 'circle' | 'polygon';
  polygonPoints: [number, number][];
  onLocationChange: (lat: number, lon: number) => void;
  onPolygonChange: (points: [number, number][]) => void;
  onKmlDrop?: (filePath: string) => void;
  mapStyle: string;
  onMapStyleChange: (style: string) => void;
  showAnalysis: boolean;
  onShowAnalysisChange: (show: boolean) => void;
  geojson?: GeoJsonObject | null;
}

const SelectionManager = ({
  lat,
  lon,
  radius,
  selectionMode,
  polygonPoints,
  onLocationChange,
  onPolygonChange
}: Omit<MapSelectorProps, 'geojson' | 'mapStyle' | 'onMapStyleChange' | 'onKmlDrop' | 'showAnalysis' | 'onShowAnalysisChange'>) => {
  useMapEvents({
    click(e) {
      if (selectionMode === 'circle') {
        onLocationChange(e.latlng.lat, e.latlng.lng);
      } else {
        onPolygonChange([...polygonPoints, [e.latlng.lat, e.latlng.lng]]);
      }
    },
  });

  return (
    <>
      {selectionMode === 'circle' && lat && lon && (
        <>
          <Marker position={[lat, lon]} />
          <Circle
            center={[lat, lon]}
            radius={radius}
            pathOptions={{
              fillColor: '#3b82f6',
              fillOpacity: 0.1,
              color: '#60a5fa',
              weight: 1,
              dashArray: '5, 5'
            }}
          />
        </>
      )}
      {selectionMode === 'polygon' && polygonPoints.length > 0 && (
        <>
          {polygonPoints.map((point, i) => (
            <Marker key={i} position={point} />
          ))}
          {polygonPoints.length > 1 && (
            <Polyline
              positions={polygonPoints}
              pathOptions={{ color: '#a78bfa', weight: 2, dashArray: '5, 5' }}
            />
          )}
          {polygonPoints.length > 2 && (
            <Polygon
              positions={polygonPoints}
              pathOptions={{
                fillColor: '#8b5cf6',
                fillOpacity: 0.2,
                color: '#a78bfa',
                weight: 2
              }}
            />
          )}
        </>
      )}
    </>
  );
};

const MapSelector: React.FC<MapSelectorProps> = ({
  lat, lon, radius, selectionMode, polygonPoints, onLocationChange, onPolygonChange, onKmlDrop, mapStyle, onMapStyleChange, showAnalysis, onShowAnalysisChange, geojson
}) => {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (onKmlDrop && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      // @ts-ignore - Electron-specific property
      if (file.path && (file.path.toLowerCase().endsWith('.kml') || file.path.toLowerCase().endsWith('.kmz'))) {
        // @ts-ignore
        onKmlDrop(file.path);
      }
    }
  };

  const getTileConfig = () => {
    switch (mapStyle) {
      case 'roadmap':
        return {
          url: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
          attribution: "&copy; Google Maps"
        };
      case 'satellite':
        return {
          url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
          attribution: "&copy; Google Earth"
        };
      case 'hybrid':
        return {
          url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
          attribution: "&copy; Google Earth Hybrid"
        };
      case 'osm':
      default:
        return {
          url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          attribution: "&copy; OpenStreetMap contributors"
        };
    }
  };

  const tileConfig = getTileConfig();

  // Filter pre-calculated analysis features from Backend
  const analysisLayers = useMemo(() => {
    if (!geojson || !showAnalysis) return null;
    const fc = geojson as FeatureCollection;
    return fc.features.filter(f => f.properties?.is_analysis);
  }, [geojson, showAnalysis]);

  return (
    <div
      style={{ height: '100%', width: '100%', position: 'relative' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Map Controls */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'flex-end'
      }}>
        {/* Style Toggle */}
        <div className="glass" style={{
          display: 'flex',
          gap: '4px',
          padding: '4px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          {[
            { id: 'osm', label: 'OSM' },
            { id: 'roadmap', label: 'Roadmap' },
            { id: 'satellite', label: 'Satellite' },
            { id: 'hybrid', label: 'Hybrid' }
          ].map(style => (
            <button
              key={style.id}
              onClick={() => onMapStyleChange(style.id)}
              className="btn-map-style"
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                borderRadius: '6px',
                background: mapStyle === style.id ? 'rgba(59, 130, 246, 0.5)' : 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              {style.label}
            </button>
          ))}
        </div>

        {/* Analysis Toggle */}
        <button
          onClick={() => onShowAnalysisChange(!showAnalysis)}
          className={`glass ${showAnalysis ? 'active' : ''}`}
          style={{
            padding: '8px 16px',
            fontSize: '12px',
            borderRadius: '8px',
            color: 'white',
            border: showAnalysis ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
            background: showAnalysis ? 'rgba(59, 130, 246, 0.2)' : 'rgba(15, 23, 42, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {showAnalysis ? '🛡️ Analysis ON' : '🔍 Analysis OFF'}
        </button>
      </div>

      <MapContainer
        center={[lat, lon]}
        zoom={15}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
      >
        <TileLayer
          key={mapStyle}
          attribution={tileConfig.attribution}
          url={tileConfig.url}
        />
        <SelectionManager
          lat={lat}
          lon={lon}
          radius={radius}
          selectionMode={selectionMode}
          polygonPoints={polygonPoints}
          onLocationChange={onLocationChange}
          onPolygonChange={onPolygonChange}
        />
        {geojson && (
          <GeoJSON
            key={`base-${JSON.stringify(geojson).length}`}
            data={{
              type: 'FeatureCollection',
              features: (geojson as FeatureCollection).features.filter(f => !f.properties?.is_analysis)
            } as any}
            style={(feature) => {
              const props = feature?.properties || {};
              if (props.building) return { color: '#ef4444', weight: 1, fillOpacity: 0.4 };
              if (props.highway) return { color: '#94a3b8', weight: 2 };
              if (props.natural === 'tree' || props.natural === 'wood') return { color: '#22c55e', weight: 5 };
              return { color: '#64748b', weight: 1 };
            }}
            onEachFeature={(feature, layer) => {
              if (feature.properties && feature.properties.name) {
                layer.bindPopup(feature.properties.name);
              }
            }}
          />
        )}

        {/* Pulsing Violation Markers */}
        {showAnalysis && (geojson as any)?.audit_summary?.violations_list?.map((v: any, i: number) => (
          <Marker
            key={`violation-${i}`}
            position={[v.lat, v.lon]}
            icon={L.divIcon({
              className: 'custom-div-icon',
              html: `<div class="pulsing-violation"></div>`,
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            })}
          >
            <Popup>
              <div style={{ color: '#ef4444', fontWeight: 'bold' }}>Engineering Violation</div>
              <div>{v.description}</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MapSelector;
