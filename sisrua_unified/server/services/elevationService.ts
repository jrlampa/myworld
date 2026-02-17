import { GeoLocation } from '../../src/types.js';

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

        const response = await fetch("https://api.open-elevation.com/api/v1/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locations })
        });

        if (!response.ok) throw new Error("Elevation API failed");
        const data = await response.json();

        const totalDist = this.calculateDistance(start, end);

        return data.results.map((r: any, i: number) => ({
            dist: parseFloat(((totalDist * i) / steps).toFixed(1)),
            elev: r.elevation
        }));
    }
}
