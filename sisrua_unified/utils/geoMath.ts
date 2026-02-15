/**
 * Utility for local geospatial calculations.
 * Note: Heavy geocoding and profiling moved to Smart Backend.
 */

import { GeoLocation } from '../types';

/**
 * Calculates simplified sun position.
 * Returns azimuth and altitude in radians.
 */
export const calculateSunPosition = (lat: number, hour: number) => {
    const latRad = (lat * Math.PI) / 180;
    const declination = 0;
    const h = (hour - 12) * 15 * (Math.PI / 180);

    const sinAlt = Math.sin(latRad) * Math.sin(declination) + Math.cos(latRad) * Math.cos(declination) * Math.cos(h);
    const alt = Math.asin(sinAlt);
    const cosAz = (Math.sin(declination) * Math.cos(latRad) - Math.cos(declination) * Math.sin(latRad) * Math.cos(h)) / Math.cos(alt);
    let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));

    if (hour > 12) az = 2 * Math.PI - az;

    return {
        altitude: alt,
        azimuth: az
    };
};

export const calculateShadowOffset = (height: number, sunPos: { altitude: number, azimuth: number }, pixelScale: number) => {
    if (sunPos.altitude <= 0) return { x: 0, y: 0 };
    const length = height / Math.tan(Math.max(0.1, sunPos.altitude));
    const shadowAzimuth = sunPos.azimuth + Math.PI;

    const dx = Math.sin(shadowAzimuth) * length * pixelScale;
    const dy = Math.cos(shadowAzimuth) * length * pixelScale;

    return { x: dx, y: -dy };
};
