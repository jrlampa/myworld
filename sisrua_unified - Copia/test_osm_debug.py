import requests
import json
from pyproj import Transformer

# Converter UTM 23K 788512 7634958 para lat/lng
transformer = Transformer.from_crs('EPSG:32723', 'EPSG:4326', always_xy=True)
lng, lat = transformer.transform(788512, 7634958)
print(f'Center: lat={lat:.6f}, lng={lng:.6f}')
print()

# Test query Overpass
query = f"""[out:json][timeout:20];
(
  way(around:500,{lat},{lng})["building"];
  way(around:500,{lat},{lng})["highway"];
  node(around:500,{lat},{lng})["natural"="tree"];
);
out geom;"""

print('===== Query =====')
print(query)
print()

try:
    print('Sending request to Overpass API...')
    response = requests.post(
        'https://overpass-api.de/api/interpreter',
        data={'data': query},
        timeout=20,
    )
    response.raise_for_status()
    data = response.json()
    
    print(f'Response status: {response.status_code}')
    print(f'Total elements: {len(data.get("elements", []))}')
    print()
    
    # Count by type
    buildings = 0
    roads = 0
    trees = 0
    for elem in data.get('elements', []):
        if elem.get('type') == 'way':
            if elem.get('tags', {}).get('building'): 
                buildings += 1
            if elem.get('tags', {}).get('highway'): 
                roads += 1
        elif elem.get('type') == 'node':
            if elem.get('tags', {}).get('natural') == 'tree': 
                trees += 1
    
    print(f'Buildings: {buildings}')
    print(f'Roads: {roads}')
    print(f'Trees: {trees}')
    print()
    
    if len(data.get('elements', [])) > 0:
        print('First 3 elements:')
        print(json.dumps(data.get('elements', [])[:3], indent=2, default=str))
    else:
        print('No elements returned!')
        if 'remark' in data:
            print(f'Remark: {data["remark"]}')
        
except Exception as e:
    print(f'ERROR: {type(e).__name__}: {e}')
    import traceback
    traceback.print_exc()
