import React, { useEffect, useRef } from "react";
// npm install leaflet leaflet-draw
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";

interface MapMeasureProps {
  center: [number, number];
  zoom: number;
}

const MapMeasure: React.FC<MapMeasureProps> = ({ center, zoom }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    leafletMap.current = L.map(mapRef.current).setView(center, zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(leafletMap.current);
    // Ferramentas de desenho e medição
    const drawnItems = new L.FeatureGroup();
    leafletMap.current.addLayer(drawnItems);
    const drawControl = new L.Control.Draw({
      edit: { featureGroup: drawnItems },
      draw: {
        polygon: true,
        polyline: true,
        rectangle: true,
        circle: false,
        marker: true,
        circlemarker: false,
      },
    });
    leafletMap.current.addControl(drawControl);
    leafletMap.current.on(L.Draw.Event.CREATED, function (e: any) {
      drawnItems.addLayer(e.layer);
      // Exibe medida
      if (e.layer instanceof L.Polyline) {
        const len = L.GeometryUtil.length(e.layer);
        alert(`Comprimento: ${(len / 1000).toFixed(2)} km`);
      }
      if (e.layer instanceof L.Polygon) {
        const area = L.GeometryUtil.geodesicArea(e.layer.getLatLngs()[0]);
        alert(`Área: ${(area / 10000).toFixed(2)} ha`);
      }
    });
  }, [center, zoom]);

  return <div ref={mapRef} style={{ width: "100%", height: 500 }} />;
};

export default MapMeasure;
