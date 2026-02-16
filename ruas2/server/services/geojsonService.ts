import { OsmElement, LayerConfig } from '../../types';

export const generateGeoJSON = (elements: OsmElement[], layers: LayerConfig) => {
  const features: any[] = [];

  elements.forEach(el => {
    // Determine category based on tags
    const isBuilding = !!el.tags?.building;
    const isRoad = !!el.tags?.highway;
    const isNature = !!(el.tags?.natural || el.tags?.landuse || el.tags?.waterway);
    // Basic check for furniture/details if it's not one of the above
    const isFurniture = !isBuilding && !isRoad && !isNature && (!!el.tags?.amenity || !!el.tags?.man_made || !!el.tags?.barrier);

    // Filter based on LayerConfig
    if (isBuilding && !layers.buildings) return;
    if (isRoad && !layers.roads) return;
    if (isNature && !layers.nature) return;
    if (isFurniture && !layers.furniture) return;
    
    // If it doesn't fit any category (and isn't explicitly filtered out), we skip it to keep output clean,
    // unless strict mode is off. For this app, we strictly follow the toggles.
    if (!isBuilding && !isRoad && !isNature && !isFurniture) return;

    const properties = { ...el.tags, osm_id: el.id, osm_type: el.type };
    
    if (el.type === 'node') {
      features.push({
        type: 'Feature',
        properties,
        geometry: {
          type: 'Point',
          coordinates: [el.lon, el.lat]
        }
      });
    } 
    else if (el.type === 'way' && el.geometry) {
      const coords = el.geometry.map(p => [p.lon, p.lat]);
      const isClosed = el.nodes && el.nodes[0] === el.nodes[el.nodes.length - 1];
      
      // Determine geometry type
      let geometryType = 'LineString';
      // Treat as Polygon if it's a building or closed area
      if (isBuilding || (isClosed && (isNature || el.tags?.area === 'yes'))) {
         // Ensure it is closed for Polygon
         if (coords.length > 0) {
            const first = coords[0];
            const last = coords[coords.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                coords.push(first);
            }
         }
         // A valid LinearRing must have at least 4 positions (3 points + closing point)
         if (coords.length >= 4) {
             geometryType = 'Polygon';
         }
      }

      features.push({
        type: 'Feature',
        properties,
        geometry: {
          type: geometryType,
          coordinates: geometryType === 'Polygon' ? [coords] : coords
        }
      });
    }
    else if (el.type === 'relation') {
       // Simple Relation Handling: Emit members as features with relation properties
       // Note: Full Multipolygon stitching is complex and outside this scope. 
       // We emit the individual geometries of the members.
       if (!el.members) return;
       
       el.members.forEach(member => {
         if (member.geometry) {
           const memCoords = member.geometry.map(p => [p.lon, p.lat]);
           let memGeomType = 'LineString';
           
           // If member is 'outer' and relation is multipolygon-ish
           if (member.role === 'outer' && (isBuilding || isNature)) {
              if (memCoords.length > 0) {
                  const first = memCoords[0];
                  const last = memCoords[memCoords.length - 1];
                  if (first[0] === last[0] && first[1] === last[1] && memCoords.length >= 4) {
                      memGeomType = 'Polygon';
                  }
              }
           }
           
           features.push({
             type: 'Feature',
             properties: { 
                 ...properties, 
                 member_ref: member.ref, 
                 member_role: member.role, 
                 member_type: member.type 
             },
             geometry: {
               type: memGeomType,
               coordinates: memGeomType === 'Polygon' ? [memCoords] : memCoords
             }
           });
         }
       });
    }
  });

  return JSON.stringify({
    type: 'FeatureCollection',
    features
  }, null, 2);
};