export interface GeoLocation {
    lat: number;
    lng: number;
    label?: string;
}

export class GeocodingService {
    private static parseLatLng(query: string): GeoLocation | null {
        const normalized = query
            .replace(/\(([^)]+)\)/g, '$1')
            .replace(/(\d),(\d)/g, '$1.$2')
            .replace(/,/g, ' ');

        const numbers = normalized.match(/[-+]?\d+(?:\.\d+)?/g);
        if (!numbers || numbers.length < 2) return null;

        const lat = parseFloat(numbers[0]);
        const lng = parseFloat(numbers[1]);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

        return {
            lat,
            lng,
            label: `Lat/Lng ${lat.toFixed(6)}, ${lng.toFixed(6)}`
        };
    }

    private static parseUtm(query: string): { zone: number; hemisphere: 'N' | 'S'; easting: number; northing: number } | null {
        const normalized = query
            .replace(/(\d),(\d)/g, '$1.$2')
            .replace(/,/g, ' ')
            .trim();

        const utmMatch = normalized.match(/(\d{1,2})([C-HJ-NP-X]|[NS])?\s+(\d{6,7}(?:\.\d+)?)\s+(\d{7}(?:\.\d+)?)/i);
        if (!utmMatch) return null;

        const zone = parseInt(utmMatch[1], 10);
        const zoneLetter = utmMatch[2]?.toUpperCase();
        const easting = parseFloat(utmMatch[3]);
        const northing = parseFloat(utmMatch[4]);

        if (!Number.isFinite(zone) || !Number.isFinite(easting) || !Number.isFinite(northing)) return null;
        if (zone < 1 || zone > 60) return null;

        const isSouthBand = zoneLetter === 'S' || !!zoneLetter?.match(/^[C-M]$/);
        const isNorthBand = zoneLetter === 'N' || !!zoneLetter?.match(/^[N-X]$/);

        if (zoneLetter && !isSouthBand && !isNorthBand) return null;

        let hemisphere: 'N' | 'S' = 'S';
        if (zoneLetter) {
            // MGRS latitude bands: C-M = South, N-X = North (I and O omitted)
            hemisphere = isSouthBand ? 'S' : 'N';
        }

        return { zone, hemisphere, easting, northing };
    }

    /**
     * Converts UTM coordinates to Latitude/Longitude
     */
    static utmToLatLon(zone: number, hemisphere: 'N' | 'S', easting: number, northing: number): GeoLocation | null {
        if (!zone || !easting || !northing) return null;

        const a = 6378137; // WGS84 semi-major axis
        const f = 1 / 298.257223563; // WGS84 flattening
        const k0 = 0.9996; // UTM scale factor
        const e = Math.sqrt(f * (2 - f));

        const x = easting - 500000;
        const y = hemisphere === 'S' ? northing - 10000000 : northing;

        const m = y / k0;
        const mu = m / (a * (1 - Math.pow(e, 2) / 4 - 3 * Math.pow(e, 4) / 64 - 5 * Math.pow(e, 6) / 256));

        const e1 = (1 - Math.sqrt(1 - Math.pow(e, 2))) / (1 + Math.sqrt(1 - Math.pow(e, 2)));

        const J1 = (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32);
        const J2 = (21 * Math.pow(e1, 2) / 16 - 55 * Math.pow(e1, 4) / 32);
        const J3 = (151 * Math.pow(e1, 3) / 96);
        const J4 = (1097 * Math.pow(e1, 4) / 512);

        const fp = mu + J1 * Math.sin(2 * mu) + J2 * Math.sin(4 * mu) + J3 * Math.sin(6 * mu) + J4 * Math.sin(8 * mu);

        const e2 = Math.pow(e, 2) / (1 - Math.pow(e, 2));
        const c1 = e2 * Math.pow(Math.cos(fp), 2);
        const t1 = Math.pow(Math.tan(fp), 2);
        const r1 = a * (1 - Math.pow(e, 2)) / Math.pow(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2), 1.5);
        const n1 = a / Math.sqrt(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2));
        const d = x / (n1 * k0);

        const latRad = fp - (n1 * Math.tan(fp) / r1) * (Math.pow(d, 2) / 2 - (5 + 3 * t1 + 10 * c1 - 4 * Math.pow(c1, 2) - 9 * e2) * Math.pow(d, 4) / 24 + (61 + 90 * t1 + 298 * c1 + 45 * Math.pow(t1, 2) - 252 * e2 - 3 * Math.pow(c1, 2)) * Math.pow(d, 6) / 720);
        const lngRad = (d - (1 + 2 * t1 + c1) * Math.pow(d, 3) / 6 + (5 - 2 * c1 + 28 * t1 - 3 * Math.pow(c1, 2) + 8 * e2 + 24 * Math.pow(t1, 2)) * Math.pow(d, 5) / 120) / Math.cos(fp);

        const zoneCentralMeridian = (zone - 1) * 6 - 180 + 3;
        const lng = (lngRad * 180 / Math.PI) + zoneCentralMeridian;
        const lat = latRad * 180 / Math.PI;

        return { lat, lng };
    }

    /**
     * Resolves a query string into coordinates using explicit parsing only.
     */
    static async resolveLocation(query: string): Promise<GeoLocation | null> {
        // 0. Try direct lat/lng
        const latLng = this.parseLatLng(query);
        if (latLng) {
            return latLng;
        }

        // 1. Try UTM
        const utm = this.parseUtm(query);
        if (utm) {
            const coords = this.utmToLatLon(utm.zone, utm.hemisphere, utm.easting, utm.northing);
            if (coords) {
                return { ...coords, label: `UTM ${utm.zone}${utm.hemisphere} ${utm.easting} ${utm.northing}` };
            }
        }

        return null;
    }
}
