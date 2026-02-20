import React, { useRef } from "react";

interface ImportKmlGeoJsonProps {
  onData: (geojson: any) => void;
}

function parseKmlToGeoJson(kmlText: string): any {
  // Usa togeojson (https://github.com/mapbox/togeojson)
  // npm install @tmcw/togeojson xmldom
  const { DOMParser } = require("xmldom");
  const tj = require("@tmcw/togeojson");
  const dom = new DOMParser().parseFromString(kmlText, "text/xml");
  return tj.kml(dom);
}

function parseGeoJson(text: string): any {
  return JSON.parse(text);
}

const ImportKmlGeoJson: React.FC<ImportKmlGeoJsonProps> = ({ onData }) => {
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    if (file.name.endsWith(".kml")) {
      const geojson = parseKmlToGeoJson(text);
      onData(geojson);
    } else if (file.name.endsWith(".geojson") || file.name.endsWith(".json")) {
      const geojson = parseGeoJson(text);
      onData(geojson);
    } else {
      alert("Formato não suportado. Use KML ou GeoJSON.");
    }
  };

  return (
    <div>
      <input
        type="file"
        accept=".kml,.geojson,.json"
        ref={fileInput}
        onChange={handleFile}
      />
    </div>
  );
};

export default ImportKmlGeoJson;
