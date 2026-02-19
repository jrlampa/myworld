from dataclasses import dataclass
from typing import Dict, List, Tuple
import time

import requests


@dataclass(frozen=True)
class OSMFeatureCollection:
    buildings: List[List[Tuple[float, float]]]
    roads: List[List[Tuple[float, float]]]  # With metadata: name, highway type
    trees: List[Tuple[float, float]]
    parks: List[List[Tuple[float, float]]]  # Green areas/parks
    water: List[List[Tuple[float, float]]]  # Water bodies
    power_lines: List[List[Tuple[float, float]]]  # Power infrastructure
    waterways: List[List[Tuple[float, float]]]  # Rivers, streams
    amenities: List[Tuple[float, float, str]]  # (lat, lon, type) - hospitals, schools, shops
    roads_with_names: List[Tuple[List[Tuple[float, float]], str]]  # (coordinates, name)


def fetch_osm_features(lat: float, lng: float, radius_m: float, timeout_seconds: int = 30) -> OSMFeatureCollection:
    """Fetch OSM features with retry logic for API timeouts."""
    query = f"""[out:json][timeout:25];
(
  way(around:{int(radius_m)},{lat},{lng})["building"];
  way(around:{int(radius_m)},{lat},{lng})["highway"];
  way(around:{int(radius_m)},{lat},{lng})["natural"="water"];
  way(around:{int(radius_m)},{lat},{lng})["waterway"];
  way(around:{int(radius_m)},{lat},{lng})["leisure"="park"];
  way(around:{int(radius_m)},{lat},{lng})["landuse"="park"];
  way(around:{int(radius_m)},{lat},{lng})["landuse"="grass"];
  way(around:{int(radius_m)},{lat},{lng})["power"="line"];
  node(around:{int(radius_m)},{lat},{lng})["natural"="tree"];
  node(around:{int(radius_m)},{lat},{lng})["amenity"~"hospital|school|pharmacy|bank|cafe|restaurant|shop|fuel|parking"];
);
out geom;"""

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = requests.post(
                "https://overpass-api.de/api/interpreter",
                data={"data": query},
                timeout=timeout_seconds,
            )
            
            # 429 = rate limit, 504 = timeout - retry
            if response.status_code in (429, 504):
                wait_time = (2 ** attempt) * 2  # 2, 4, 8 seconds
                if attempt < max_retries - 1:
                    print(f"[OSM] Status {response.status_code}, retry in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                else:
                    return OSMFeatureCollection(
                        buildings=[], roads=[], trees=[], parks=[], water=[],
                        power_lines=[], waterways=[], amenities=[], roads_with_names=[]
                    )
            
            response.raise_for_status()
            payload = response.json()
            break
            
        except (requests.Timeout, requests.ConnectionError) as e:
            if attempt < max_retries - 1:
                wait_time = (2 ** attempt) * 2
                print(f"[OSM] Connection error, retry in {wait_time}s... ({e})")
                time.sleep(wait_time)
            else:
                print(f"[OSM] Failed after {max_retries} retries: {e}")
                return OSMFeatureCollection(
                    buildings=[], roads=[], trees=[], parks=[], water=[],
                    power_lines=[], waterways=[], amenities=[], roads_with_names=[]
                )
        except Exception as e:
            print(f"[OSM] Unexpected error: {e}")
            return OSMFeatureCollection(
                buildings=[], roads=[], trees=[], parks=[], water=[],
                power_lines=[], waterways=[], amenities=[], roads_with_names=[]
            )

    buildings: List[List[Tuple[float, float]]] = []
    roads: List[List[Tuple[float, float]]] = []
    roads_with_names: List[Tuple[List[Tuple[float, float]], str]] = []
    trees: List[Tuple[float, float]] = []
    parks: List[List[Tuple[float, float]]] = []
    water: List[List[Tuple[float, float]]] = []
    power_lines: List[List[Tuple[float, float]]] = []
    waterways: List[List[Tuple[float, float]]] = []
    amenities: List[Tuple[float, float, str]] = []

    for element in payload.get("elements", []):
        etype = element.get("type")
        tags = element.get("tags", {})

        if etype == "node":
            lat_node = element.get("lat")
            lon_node = element.get("lon")
            if lat_node is None or lon_node is None:
                continue
                
            # Trees
            if tags.get("natural") == "tree":
                trees.append((float(lat_node), float(lon_node)))
            
            # Amenities (hospitals, schools, shops, etc)
            elif "amenity" in tags:
                amenity_type = tags.get("amenity", "unknown")
                amenities.append((float(lat_node), float(lon_node), amenity_type))

        elif etype == "way":
            # Extract coordinates from geometry field (out geom format)
            coordinates: List[Tuple[float, float]] = []
            
            if "geometry" in element:
                coordinates = [
                    (float(pt["lat"]), float(pt["lon"]))
                    for pt in element.get("geometry", [])
                ]
            else:
                continue

            if len(coordinates) < 2:
                continue

            # Classify by tag
            if tags.get("building"):
                if coordinates[0] != coordinates[-1]:
                    coordinates = coordinates + [coordinates[0]]
                buildings.append(coordinates)
            elif tags.get("highway"):
                roads.append(coordinates)
                road_name = tags.get("name", "")
                if road_name and road_name.lower() != "nan":
                    roads_with_names.append((coordinates, road_name))
            elif tags.get("natural") == "water":
                if coordinates[0] != coordinates[-1]:
                    coordinates = coordinates + [coordinates[0]]
                water.append(coordinates)
            elif tags.get("waterway"):
                # Rivers/streams - keep as line
                waterways.append(coordinates)
            elif tags.get("leisure") == "park" or tags.get("landuse") in ["park", "grass"]:
                # Parks/green areas - close polygon
                if coordinates[0] != coordinates[-1]:
                    coordinates = coordinates + [coordinates[0]]
                parks.append(coordinates)
            elif tags.get("power") == "line":
                # Power lines - keep as line
                power_lines.append(coordinates)

    return OSMFeatureCollection(
        buildings=buildings, 
        roads=roads, 
        trees=trees, 
        parks=parks,
        water=water,
        power_lines=power_lines,
        waterways=waterways,
        amenities=amenities,
        roads_with_names=roads_with_names
    )
