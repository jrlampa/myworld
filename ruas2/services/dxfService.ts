
import { OsmElement, GeoLocation, TerrainGrid, LayerConfig, ProjectionType, SimplificationLevel, ProjectMetadata, AnalysisStats, Violation } from '../types';

// --- Thin Client API Consumer (with Progress) ---

export const generateDXF = async (
  elements: OsmElement[], 
  center: GeoLocation, 
  terrain: TerrainGrid | undefined, 
  optionsInput: { 
      simplificationLevel?: SimplificationLevel; 
      layers?: LayerConfig; 
      projection?: ProjectionType; 
      projectMetadata?: ProjectMetadata; 
      contourInterval?: number;
      orthogonalize?: boolean; 
  } = {},
  onProgress?: (percent: number, message: string) => void
): Promise<Blob> => {
    
  try {
      // 1. Start Job
      if (onProgress) onProgress(0, "Iniciando Job no Servidor...");
      const startRes = await fetch('http://localhost:3000/api/dxf/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            elements, 
            center, 
            terrain, 
            options: optionsInput 
        })
      });

      if (!startRes.ok) throw new Error("Falha ao iniciar geração de DXF.");
      const { jobId } = await startRes.json();

      // 2. Monitor Progress via SSE
      await new Promise<void>((resolve, reject) => {
          const evtSource = new EventSource(`http://localhost:3000/api/dxf/progress/${jobId}`);
          
          evtSource.onmessage = (e) => {
              try {
                  const data = JSON.parse(e.data);
                  
                  if (data.status === 'processing') {
                      if (onProgress) onProgress(data.progress, data.message || "Processando...");
                  } 
                  else if (data.status === 'completed') {
                      if (onProgress) onProgress(100, "Download Pronto!");
                      evtSource.close();
                      resolve();
                  } 
                  else if (data.status === 'failed') {
                      evtSource.close();
                      reject(new Error(data.error || "Job falhou."));
                  }
              } catch (err) {
                  evtSource.close();
                  reject(err);
              }
          };

          evtSource.onerror = () => {
              evtSource.close();
              reject(new Error("Erro na conexão de eventos."));
          };
      });

      // 3. Download
      if (onProgress) onProgress(100, "Baixando arquivo...");
      const downloadRes = await fetch(`http://localhost:3000/api/dxf/download/${jobId}`);
      if (!downloadRes.ok) throw new Error("Erro no download do arquivo.");
      
      return await downloadRes.blob();

  } catch (err) {
      console.error("DXF Generation Error:", err);
      throw err;
  }
};

// --- Frontend Statistics Helper (Kept on frontend for fast UI feedback before download) ---

const getBounds = (geometry: {lat: number, lon: number}[]) => {
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    geometry.forEach(p => {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lon < minLon) minLon = p.lon;
        if (p.lon > maxLon) maxLon = p.lon;
    });
    return { minLat, maxLat, minLon, maxLon };
};

const doBoxesIntersect = (a: any, b: any) => {
    return (a.minLat <= b.maxLat && a.maxLat >= b.minLat) &&
           (a.minLon <= b.maxLon && a.maxLon >= b.minLon);
};

export const calculateStats = (elements: OsmElement[]): AnalysisStats => {
  let buildings = 0;
  let roads = 0;
  let nature = 0;
  let totalHeight = 0;
  let heightCount = 0;
  let maxHeight = 0;
  const violations: Violation[] = [];

  const buildingGeoms: { id: string, bounds: any }[] = [];
  const roadGeoms: { id: string, bounds: any, type: string }[] = [];

  elements.forEach(el => {
    if (el.tags?.building) {
        buildings++;
        if (el.type === 'way' && el.geometry) {
            buildingGeoms.push({ id: el.id.toString(), bounds: getBounds(el.geometry) });
        }
    }
    if (el.tags?.highway) {
        roads++;
        if (el.type === 'way' && el.geometry) {
            roadGeoms.push({ id: el.id.toString(), bounds: getBounds(el.geometry), type: el.tags.highway });
        }
    }
    if (el.tags?.natural || el.tags?.landuse) nature++;
    
    let h = 0;
    if (el.tags?.height) h = parseFloat(el.tags.height);
    else if (el.tags?.['building:levels']) h = parseFloat(el.tags['building:levels']) * 3.2;
    
    if (h > 0) {
      totalHeight += h;
      heightCount++;
      if (h > maxHeight) maxHeight = h;
    }

    let loc: GeoLocation = { lat: 0, lng: 0 };
    if (el.type === 'node') {
        loc = { lat: el.lat, lng: el.lon };
    } else if (el.type === 'way' && el.geometry && el.geometry.length > 0) {
        loc = { lat: el.geometry[0].lat, lng: el.geometry[0].lon };
    }

    const idStr = el.id.toString();

    if (el.tags?.building && !el.tags.height && !el.tags['building:levels'] && el.tags.building !== 'house') {
       if (['apartments', 'office', 'hotel', 'hospital'].includes(el.tags.building)) {
          violations.push({
             id: idStr,
             type: 'info',
             message: `Edifício (${el.tags.building}) sem altura definida.`,
             location: loc
          });
       }
    }

    if (h > 50) {
       violations.push({
          id: idStr,
          type: 'critical',
          message: `Edifício alto (${h.toFixed(1)}m). Requer verificação.`,
          location: loc
       });
    }

    if (el.tags?.highway && ['primary', 'secondary', 'trunk'].includes(el.tags.highway) && !el.tags.name) {
       violations.push({
          id: idStr,
          type: 'warning',
          message: `Via principal (${el.tags.highway}) sem nome.`,
          location: loc
       });
    }
  });

  let checks = 0;
  for (const b of buildingGeoms) {
      if (checks > 1000) break; 
      for (const r of roadGeoms) {
          if (checks > 1000) break;
          
          if (doBoxesIntersect(b.bounds, r.bounds)) {
             violations.push({
                 id: b.id,
                 type: 'critical',
                 message: `Conflito Geométrico: Edifício sobrepõe Via (${r.type})`,
                 location: { lat: (b.bounds.minLat + b.bounds.maxLat)/2, lng: (b.bounds.minLon + b.bounds.maxLon)/2 }
             });
             checks++; 
          }
      }
      checks++;
  }

  return {
    totalBuildings: buildings,
    totalRoads: roads,
    totalNature: nature,
    avgHeight: heightCount > 0 ? totalHeight / heightCount : 0,
    maxHeight,
    violations: violations.slice(0, 50)
  };
};
