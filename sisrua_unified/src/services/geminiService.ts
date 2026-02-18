import { GeoLocation } from '../types';
import Logger from '../utils/logger';
import { API_BASE_URL } from '../config/api';

const API_URL = API_BASE_URL;

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
    
    // Handle error responses
    if (!response.ok) {
      try {
        const errorData = await response.json();
        Logger.warn("Analysis request failed", { status: response.status, error: errorData });
        
        // If the backend provides an analysis message (e.g., for missing API key), use it
        if (errorData.analysis) {
          return errorData.analysis;
        }
        
        // Otherwise provide a helpful error message
        const errorMsg = errorData.message || errorData.error || 'Analysis failed';
        return `**Erro na análise**: ${errorMsg}`;
      } catch {
        return "**Erro na análise**: Não foi possível processar a resposta do servidor.";
      }
    }
    
    const data = await response.json();
    Logger.info("Analysis completed");
    return data.analysis;
  } catch (error) {
    Logger.error("Analysis error:", error);
    return "**Erro de conexão**: Não foi possível contatar o servidor de análise. Verifique se o backend está em execução na porta 3001.";
  }
};