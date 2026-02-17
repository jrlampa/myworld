import { GeoLocation } from '../types';
import Logger from '../utils/logger';

export const findLocationWithGroq = async (_query: string, _enableAI: boolean): Promise<GeoLocation | null> => {
  Logger.info('Location AI is handled by backend search endpoint.');
  return null;
};

export const analyzeArea = async (stats: any, locationName: string, enableAI: boolean): Promise<string> => {
  if (!enableAI) return 'Analysis summary disabled.';

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stats, locationName })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return data?.error || 'Analysis failed.';
    }

    const data = await response.json();
    return data.analysis || 'Analysis unavailable.';
  } catch (error) {
    Logger.error('Groq analyze request failed', error);
    return 'Could not contact analysis backend.';
  }
};
