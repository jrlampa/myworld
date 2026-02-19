import sqlite3
import os
from typing import Optional, List, Tuple
from dataclasses import dataclass

@dataclass
class CachedElevation:
    elevation_m: float
    provider: str
    timestamp: float

class ElevationCache:
    """
    SQLite-based cache for elevation data.
    Stores (lat, lng) -> elevation to minimize API calls.
    Precision: 5 decimal places (~1.1m precision).
    """
    
    def __init__(self, db_path: str = "elevation_cache.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS elevation (
                    lat_key INTEGER,
                    lng_key INTEGER,
                    elevation REAL,
                    provider TEXT,
                    timestamp REAL,
                    PRIMARY KEY (lat_key, lng_key)
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_elev_lookup ON elevation (lat_key, lng_key)")

    def _key(self, val: float) -> int:
        # Round to 5 decimal places and convert to integer key
        return int(round(val, 5) * 100000)

    def get(self, lat: float, lng: float) -> Optional[CachedElevation]:
        k_lat = self._key(lat)
        k_lng = self._key(lng)
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT elevation, provider, timestamp FROM elevation WHERE lat_key = ? AND lng_key = ?", 
                (k_lat, k_lng)
            )
            row = cursor.fetchone()
            if row:
                return CachedElevation(row[0], row[1], row[2])
        return None

    def get_batch(self, points: List[Tuple[float, float]]) -> List[Optional[CachedElevation]]:
        """
        Efficiently retrieves multiple points.
        Returns a list of same length as points, with None for misses.
        """
        if not points:
            return []
            
        keys = [(self._key(p[0]), self._key(p[1])) for p in points]
        
        # Determine ranges to optimize query? Or just giant IN clause?
        # SQLite limit for variables is usually 999. We might need to chunk.
        results_map = {}
        chunk_size = 400
        
        for i in range(0, len(keys), chunk_size):
            chunk = keys[i:i+chunk_size]
            # WHERE (lat_key, lng_key) IN ((?,?), ...) is syntax supported in newer SQLite
            # Fallback: create temporary table or just loop if small batch.
            # Let's try row value syntax (lat_key, lng_key) IN (VALUES (?,?)..)
            
            # Simple fallback for compatibility: 
            # SELECT * FROM elevation WHERE lat_key IN (...) AND lng_key IN (...)
            # Then filter locally.
            
            lats = [k[0] for k in chunk]
            lngs = [k[1] for k in chunk]
            
            query = f"""
                SELECT lat_key, lng_key, elevation, provider, timestamp 
                FROM elevation 
                WHERE lat_key BETWEEN ? AND ? 
                  AND lng_key BETWEEN ? AND ?
            """
            
            # Bounding box of chunk keys
            min_lat, max_lat = min(lats), max(lats)
            min_lng, max_lng = min(lngs), max(lngs)
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(query, (min_lat, max_lat, min_lng, max_lng))
                for row in cursor:
                    results_map[(row[0], row[1])] = CachedElevation(row[2], row[3], row[4])
        
        # Build result list
        out = []
        for k_lat, k_lng in keys:
            out.append(results_map.get((k_lat, k_lng)))
        return out

    def set(self, lat: float, lng: float, elevation: float, provider: str):
        k_lat = self._key(lat)
        k_lng = self._key(lng)
        import time
        ts = time.time()
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO elevation (lat_key, lng_key, elevation, provider, timestamp) VALUES (?, ?, ?, ?, ?)",
                (k_lat, k_lng, elevation, provider, ts)
            )

    def set_batch(self, samples: List[Tuple[float, float, float, str]]):
        """
        samples: list of (lat, lng, elevation, provider)
        """
        if not samples:
            return
            
        import time
        ts = time.time()
        data = []
        for lat, lng, elev, prov in samples:
            data.append((self._key(lat), self._key(lng), elev, prov, ts))
            
        with sqlite3.connect(self.db_path) as conn:
            conn.executemany(
                "INSERT OR REPLACE INTO elevation (lat_key, lng_key, elevation, provider, timestamp) VALUES (?, ?, ?, ?, ?)",
                data
            )
