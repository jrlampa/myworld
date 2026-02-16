import { useState } from 'react';
import { generateDXF } from '../services/dxfService';
import { SelectionMode, GeoLocation, LayerConfig } from '../types';

interface UseDxfExportProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function useDxfExport({ onSuccess, onError }: UseDxfExportProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadDxf = async (
    center: GeoLocation,
    radius: number,
    selectionMode: SelectionMode,
    polygon: GeoLocation[],
    layers: LayerConfig,
    projection: 'local' | 'utm' = 'utm'
  ) => {
    setIsDownloading(true);
    
    try {
      const result = await generateDXF(
        center.lat,
        center.lng,
        radius,
        selectionMode,
        polygon,
        layers,
        projection
      );

      if (!result || !result.url) {
        throw new Error('Backend failed to generate DXF');
      }

      const filename = `dxf_export_${center.lat.toFixed(4)}_${center.lng.toFixed(4)}.dxf`;
      const a = document.createElement('a');
      a.href = result.url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      onSuccess('DXF Downloaded');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'DXF generation failed';
      onError(`DXF Error: ${message}`);
      return false;
    } finally {
      setIsDownloading(false);
    }
  };

  return {
    downloadDxf,
    isDownloading
  };
}
