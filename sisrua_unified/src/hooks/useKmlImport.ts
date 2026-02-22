import { useState } from 'react';
import { parseKml } from '../utils/kmlParser';
import { GeoLocation } from '../types';

interface UseKmlImportProps {
  onImportSuccess: (points: GeoLocation[], filename: string) => void;
  onError: (message: string) => void;
}

export function useKmlImport({ onImportSuccess, onError }: UseKmlImportProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const importKml = async (file: File) => {
    setIsProcessing(true);
    
    try {
      const points = await parseKml(file);

      if (!points || points.length === 0) {
        throw new Error('No valid points found in KML file');
      }

      const geoPoints: GeoLocation[] = points.map(p => ({ 
        lat: p[0], 
        lng: p[1] 
      }));

      onImportSuccess(geoPoints, file.name.replace('.kml', ''));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'KML import failed';
      onError(message);
      return false;
    /* v8 ignore next */
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    importKml,
    isProcessing
  };
}
