import { GeoLocation } from '../../src/types.js';
import { logger } from '../utils/logger.js';

export class ElevationService {
    /**
     * Calculates the Haversine distance between two points in meters
     */
    static calculateDistance(start: GeoLocation, end: GeoLocation): number {
        const R = 6371e3; // Earth's radius in meters
        const phi1 = start.lat * Math.PI / 180;
        const phi2 = end.lat * Math.PI / 180;
        const deltaPhi = (end.lat - start.lat) * Math.PI / 180;
        const deltaLambda = (end.lng - start.lng) * Math.PI / 180;

        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Fetches elevation profile points between two coordinates
     * Uses open-elevation.com API with fallback and error handling
     * 
     * Alternative services if needed:
     * - Open-Elevation: Free, self-hostable, no API key required
     * - Google Elevation API: Requires API key, paid after quota
     * - Mapbox Elevation API: Requires API key, paid
     * 
     * Current choice: Open-Elevation (free, reliable for alpha release)
     */
    static async getElevationProfile(start: GeoLocation, end: GeoLocation, steps: number = 25) {
        const locations = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            locations.push({
                latitude: start.lat + (end.lat - start.lat) * t,
                longitude: start.lng + (end.lng - start.lng) * t
            });
        }

        try {
            const response = await fetch("https://api.open-elevation.com/api/v1/lookup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ locations }),
                signal: AbortSignal.timeout(10000) // 10 second timeout
            });

            if (!response.ok) {
                logger.error('Elevation API request failed', {
                    status: response.status,
                    statusText: response.statusText
                });
                throw new Error(`Elevation API failed with status ${response.status}`);
            }

            const data = await response.json();
            const totalDist = this.calculateDistance(start, end);

            return data.results.map((r: any, i: number) => ({
                dist: parseFloat(((totalDist * i) / steps).toFixed(1)),
                elev: r.elevation
            }));

        } catch (error: any) {
            logger.error('Elevation service error', {
                error: error.message,
                start,
                end,
                steps
            });
            
            // Return fallback data (flat terrain) instead of failing
            // This ensures the app continues to work even if elevation service is down
            logger.warn('Using fallback elevation data (flat terrain)');
            const totalDist = this.calculateDistance(start, end);
            return Array.from({ length: steps + 1 }, (_, i) => ({
                dist: parseFloat(((totalDist * i) / steps).toFixed(1)),
                elev: 0 // Fallback to sea level
            }));
        }
    }
}
