import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { GeoLocation } from '../types';

interface MapPreviewProps {
  center: GeoLocation;
  radius: number;
  onCenterChange: (newCenter: GeoLocation) => void;
}

const MapPreview: React.FC<MapPreviewProps> = ({ center, radius, onCenterChange }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // Initialize Map
  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current).setView([center.lat, center.lng], 15);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(mapInstanceRef.current);
    }

    return () => {
      // Cleanup handled by ref check usually, but good practice to remove if strict
    };
  }, []); 

  // Handle Click Events
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      // Trigger parent update
      onCenterChange({
        lat,
        lng,
        label: `Selected Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`
      });
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [onCenterChange]);

  // Update View and Circle when props change
  useEffect(() => {
    if (mapInstanceRef.current) {
      // Smooth flyTo is nicer than setView for small adjustments
      mapInstanceRef.current.flyTo([center.lat, center.lng], mapInstanceRef.current.getZoom());

      // Remove old circle
      if (circleRef.current) {
        circleRef.current.remove();
      }

      // Add new circle
      circleRef.current = L.circle([center.lat, center.lng], {
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        radius: radius
      }).addTo(mapInstanceRef.current);

      // Fit bounds if radius changes significantly or on first load
      // We don't always want to fit bounds on click as it might be jarring, 
      // but keeping the circle in view is generally good.
      // mapInstanceRef.current.fitBounds(circleRef.current.getBounds(), { padding: [50, 50] });
    }
  }, [center, radius]);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl border border-slate-700 relative z-0">
      <div ref={mapContainerRef} className="w-full h-full cursor-crosshair" />
      <div className="absolute bottom-4 left-4 z-[400] bg-slate-900/80 backdrop-blur text-xs p-2 rounded text-slate-400 border border-slate-700">
        Preview Mode • Click map to fine-tune center
      </div>
    </div>
  );
};

export default MapPreview;