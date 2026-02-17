import proj4 from 'proj4';
import { GeoLocation } from '../types';

const UTM_REGEX = /^(\d{1,2})\s*([C-HJ-NP-X]|[NS])\s+(\d{6,7}(?:\.\d+)?)\s+(\d{7}(?:\.\d+)?)$/i;

export const parseUtmQuery = (query: string): GeoLocation | null => {
  const normalized = query
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/,/g, ' ')
    .trim();

  const match = normalized.match(UTM_REGEX);
  if (!match) return null;

  const zone = parseInt(match[1], 10);
  const band = match[2].toUpperCase();
  const easting = parseFloat(match[3]);
  const northing = parseFloat(match[4]);

  if (!Number.isFinite(zone) || zone < 1 || zone > 60) return null;
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null;

  const isSouthBand = band === 'S' || /^[C-M]$/.test(band);
  const isNorthBand = band === 'N' || /^[N-X]$/.test(band);
  if (!isSouthBand && !isNorthBand) return null;

  const projString = isSouthBand
    ? `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs`
    : `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`;

  // If SAD69 support is needed: +proj=utm +zone=${zone} +south +ellps=aust_SA +units=m +no_defs
  const [lng, lat] = proj4(projString, 'WGS84').forward([easting, northing]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return {
    lat,
    lng,
    label: `UTM ${zone}${band} ${easting} ${northing}`
  };
};
