import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, GeoJSON, Polygon, Polyline, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { GeoJsonObject, FeatureCollection } from 'geojson';

// Fix for default marker icon in React Leaflet
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapSelectorProps {
    center: { lat: number; lng: number; label?: string };
    radius: number;
    selectionMode: 'circle' | 'polygon' | 'measure';
    polygonPoints: [number, number][];
    onLocationChange: (newCenter: { lat: number; lng: number; label?: string }) => void;
    onPolygonChange: (points: [number, number][]) => void;
    measurePath?: [number, number][]; // optional for now
    onMeasurePathChange?: (path: [number, number][]) => void;
    onKmlDrop?: (file: File) => void;
    mapStyle?: string;
    onMapStyleChange?: (style: string) => void;
    showAnalysis?: boolean;
    geojson?: GeoJsonObject | null;
}

const SelectionManager = ({
    center,
    radius,
    selectionMode,
    polygonPoints,
    onLocationChange,
    onPolygonChange,
    measurePath = [],
    onMeasurePathChange
}: any) => {
    useMapEvents({
        click(e) {
            if (selectionMode === 'circle') {
                onLocationChange({
                    lat: e.latlng.lat,
                    lng: e.latlng.lng,
                    label: `Selected (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`
                });
            } else if (selectionMode === 'polygon') {
                onPolygonChange([...polygonPoints, [e.latlng.lat, e.latlng.lng]]);
            } else if (selectionMode === 'measure' && onMeasurePathChange) {
                // Measure mode uses 2 points
                if (measurePath.length >= 2) {
                    onMeasurePathChange([[e.latlng.lat, e.latlng.lng]]);
                } else {
                    onMeasurePathChange([...measurePath, [e.latlng.lat, e.latlng.lng]]);
                }
            }
        },
    });

    const map = useMapEvents({});

    // Fly to center when it changes
    React.useEffect(() => {
        map.flyTo([center.lat, center.lng], map.getZoom());
    }, [center.lat, center.lng, map]);

    return (
        <>
            {selectionMode === 'circle' && (
                <>
                    <Marker position={[center.lat, center.lng]} />
                    <Circle
                        center={[center.lat, center.lng]}
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
                    {polygonPoints.map((point: any, i: number) => (
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
            {selectionMode === 'measure' && measurePath.length > 0 && (
                <>
                    {measurePath.map((point: any, i: number) => (
                        <Marker key={`measure-${i}`} position={point} />
                    ))}
                    {measurePath.length > 1 && (
                        <Polyline
                            positions={measurePath}
                            pathOptions={{ color: 'orange', weight: 4, opacity: 0.8 }}
                        />
                    )}
                </>
            )}
        </>
    );
};

const MapSelector: React.FC<MapSelectorProps> = ({
    center,
    radius,
    selectionMode,
    polygonPoints,
    onLocationChange,
    onPolygonChange,
    measurePath,
    onMeasurePathChange,
    onKmlDrop,
    mapStyle = 'dark',
    onMapStyleChange,
    showAnalysis = false,
    geojson
}) => {

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (onKmlDrop && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onKmlDrop(e.dataTransfer.files[0]);
        }
    };

    return (
        <div
            className="w-full h-full rounded-xl overflow-hidden shadow-2xl border border-slate-700 relative z-0"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <MapContainer
                center={[center.lat, center.lng]}
                zoom={15}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%', background: '#0f172a' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url='https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                />

                <SelectionManager
                    center={center}
                    radius={radius}
                    selectionMode={selectionMode}
                    polygonPoints={polygonPoints}
                    onLocationChange={onLocationChange}
                    onPolygonChange={onPolygonChange}
                    measurePath={measurePath}
                    onMeasurePathChange={onMeasurePathChange}
                />

                {geojson && (
                    <GeoJSON data={geojson} />
                )}

            </MapContainer>

            {/* Overlay Controls could go here */}
            <div className="absolute bottom-4 left-4 z-[400] bg-slate-900/80 backdrop-blur text-xs p-2 rounded text-slate-400 border border-slate-700">
                {selectionMode === 'circle' ? 'Click to set center' : 'Click to add polygon points'}
            </div>
        </div>
    );
};

export default MapSelector;
