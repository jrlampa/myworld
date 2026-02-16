import { GeoLocation } from '../types';
import Logger from '../utils/logger';

const API_URL = 'http://localhost:3001/api';

export const findLocationWithGemini = async (query: string, enableAI: boolean): Promise<GeoLocation | null> => {
  if (!enableAI) {
    Logger.warn("Analysis is disabled. Cannot perform fuzzy search.");
    return null;
    // In a full implementation, we would fallback to a standard Nominatim fetch here.
  }

  try {
    Logger.debug(`Searching for location: ${query}`);
    const response = await fetch(`${API_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    Logger.error("Backend Search Error:", error);
    return null;
  }
};

export const analyzeArea = async (stats: any, locationName: string, enableAI: boolean): Promise<string> => {
  if (!enableAI) return "Analysis summary disabled.";

  try {
    Logger.debug(`Analyzing area: ${locationName}`);
    const response = await fetch(`${API_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stats, locationName })
    });
    if (!response.ok) return "Analysis failed.";
    const data = await response.json();
    Logger.info("Analysis completed");
    return data.analysis;
  } catch (error) {
    Logger.error("Analysis error:", error);
    return "Could not contact analysis backend.";
  }
};