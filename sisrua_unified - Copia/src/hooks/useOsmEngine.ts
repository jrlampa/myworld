import { useState } from 'react';
import { OsmElement, AnalysisStats, TerrainGrid, GeoLocation } from '../types';
import { fetchOsmData } from '../services/osmService';
import { fetchElevationGrid } from '../services/elevationService';
import { calculateStats } from '../services/dxfService';
import { analyzeArea } from '../services/groqService';

export function useOsmEngine() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progressValue, setProgressValue] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [osmData, setOsmData] = useState<OsmElement[] | null>(null);
    const [terrainData, setTerrainData] = useState<TerrainGrid | null>(null);
    const [stats, setStats] = useState<AnalysisStats | null>(null);
    const [analysisText, setAnalysisText] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const runAnalysis = async (center: GeoLocation, radius: number, enableAI: boolean) => {
        setIsProcessing(true);
        setError(null);
        setStatusMessage('Starting audit...');
        setProgressValue(10);

        try {
            // 1. Fetch OSM Data
            setStatusMessage('Scanning OSM Infrastructure...');
            const data = await fetchOsmData(center.lat, center.lng, radius);
            if (data.length === 0) {
                throw new Error("No architectural data found in this radius.");
            }
            setOsmData(data);
            setProgressValue(40);

            // 2. Fetch Terrain Data
            setStatusMessage('Reconstructing Terrain Grid...');
            const terrain = await fetchElevationGrid(center, radius);
            setTerrainData(terrain);
            setProgressValue(70);

            // 3. Calculate Stats authoritative on backend logic?
            // For now, client-side helper is fine, but we use the service
            const calculatedStats = calculateStats(data);
            setStats(calculatedStats);
            setProgressValue(85);

            // 4. Get analysis narrative
            if (enableAI) {
                setStatusMessage('Generating analysis summary...');
                const text = await analyzeArea(calculatedStats, center.label || "selected area", true);
                setAnalysisText(text);
            } else {
                setAnalysisText("Analysis summary disabled.");
            }

            setProgressValue(100);
            setStatusMessage('');
            return true;
        } catch (err: any) {
            setError(err.message || "Audit failed.");
            setStatusMessage('');
            return false;
        } finally {
            setTimeout(() => {
                setIsProcessing(false);
                setProgressValue(0);
            }, 800);
        }
    };

    const clearData = () => {
        setOsmData(null);
        setTerrainData(null);
        setStats(null);
        setAnalysisText('');
        setError(null);
    };

    return {
        isProcessing,
        progressValue,
        statusMessage,
        osmData,
        terrainData,
        stats,
        analysisText,
        error,
        runAnalysis,
        clearData,
        setOsmData
    };
}
