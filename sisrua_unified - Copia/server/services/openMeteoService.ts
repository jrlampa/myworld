type Coord = { lat: number; lon: number };

type ElevationResult =
  | { success: true; elevations: number[] }
  | { success: false; error: string };

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/elevation';

const chunkList = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const fetchWithTimeout = async (url: string, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const fetchOpenMeteoElevations = async (
  coords: Coord[],
  batchSize: number = 30,
  timeoutMs: number = 15000
): Promise<ElevationResult> => {
  const elevations: number[] = [];

  try {
    for (const batch of chunkList(coords, batchSize)) {
      const lats = batch.map((point) => point.lat.toFixed(6)).join(',');
      const lons = batch.map((point) => point.lon.toFixed(6)).join(',');

      const url = `${OPEN_METEO_URL}?latitude=${encodeURIComponent(lats)}&longitude=${encodeURIComponent(lons)}`;
      const response = await fetchWithTimeout(url, timeoutMs);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details');
        return {
          success: false,
          error: `Falha ao obter elevacoes do Open-Meteo (status ${response.status}): ${errorText.substring(0, 100)}`
        };
      }

      const data = await response.json();
      if (!data?.elevation || !Array.isArray(data.elevation)) {
        return {
          success: false,
          error: 'Falha ao obter elevacoes do Open-Meteo (resposta invalida).'
        };
      }

      elevations.push(...data.elevation);
    }

    return { success: true, elevations };
  } catch (error: any) {
    return {
      success: false,
      error: `Falha ao obter elevacoes do Open-Meteo: ${error?.message || 'erro inesperado'}`
    };
  }
};
