import { OsmEngineParams } from '../types';

export function validateOsmParams(params: any): { valid: boolean; error?: string } {
  if (!params.lat || typeof params.lat !== 'number' || Math.abs(params.lat) > 90) {
    return { valid: false, error: 'Invalid latitude' };
  }
  if (!params.lon || typeof params.lon !== 'number' || Math.abs(params.lon) > 180) {
    return { valid: false, error: 'Invalid longitude' };
  }
  if (!params.radius || typeof params.radius !== 'number' || params.radius <= 0 || params.radius > 5000) {
    return { valid: false, error: 'Radius must be between 0 and 5000 meters' };
  }
  if (!params.output || typeof params.output !== 'string') {
    return { valid: false, error: 'Output filename is required' };
  }

  // Polygon validation if in polygon mode
  if (params.selectionMode === 'polygon') {
    if (!Array.isArray(params.polygon) || params.polygon.length < 3) {
      return { valid: false, error: 'A valid polygon (min 3 points) is required' };
    }
  }

  return { valid: true };
}
