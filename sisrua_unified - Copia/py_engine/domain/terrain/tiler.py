
import concurrent.futures
from typing import List, Tuple, Optional
from .cache import ElevationCache, CachedElevation
from .satellite_provider import sample_elevation_batch, ElevationSample

class GridTiler:
    """
    Handles optimized fetching of elevation data for large grids.
    1. Checks ElevationCache.
    2. Batches missing points.
    3. Fetches in parallel.
    4. Updates Cache.
    """
    
    def __init__(self, cache_db_path: str = "server/data/elevation.db"):
        self.cache = ElevationCache(cache_db_path)

    def fetch_points(self, points: List[Tuple[float, float]], max_workers: int = 4) -> List[ElevationSample]:
        # 1. Check Cache
        cached_results = self.cache.get_batch(points) # Returns list of CachedElevation or None
        
        missing_indices = []
        missing_points = []
        final_samples: List[Optional[ElevationSample]] = [None] * len(points)
        
        for i, (pt, cached) in enumerate(zip(points, cached_results)):
            if cached:
                final_samples[i] = ElevationSample(
                    lat=pt[0], lng=pt[1], 
                    elevation_m=cached.elevation_m, 
                    provider=cached.provider + " (cache)", 
                    quality="cached"
                )
            else:
                missing_indices.append(i)
                missing_points.append(pt)
        
        if not missing_points:
            return final_samples

        # print(f"GridTiler: Cache hit {len(points)-len(missing_points)}/{len(points)}. Fetching {len(missing_points)}...")

        # 2. Batch Missing Points
        # Split into chunks appropriate for satellite_topography.sample_elevation_batch
        # internal logic? No, sample_elevation_batch handles its own batching for some providers.
        # BUT, to parallelize across multiple workers, we should split here.
        
        chunk_size = 200 # Reasonable chunk for parallel threads
        chunks = [missing_points[i:i + chunk_size] for i in range(0, len(missing_points), chunk_size)]
        
        fetched_data: List[Tuple[int, List[ElevationSample]]] = []
        
        # 3. Fetch in Parallel
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_chunk_idx = {
                executor.submit(sample_elevation_batch, chunk): i 
                for i, chunk in enumerate(chunks)
            }
            
            for future in concurrent.futures.as_completed(future_to_chunk_idx):
                chunk_idx = future_to_chunk_idx[future]
                try:
                    result_samples = future.result()
                    fetched_data.append((chunk_idx, result_samples))
                except Exception as e:
                    # print(f"GridTiler Error fetching chunk {chunk_idx}: {e}")
                    # Fallback? zero elevation?
                    # For Master Level, we should retry or fail gracefully.
                    # Returning 0 might ruin the map.
                    # Let's fill with 0 but mark error.
                    fallback_chunk = chunks[chunk_idx]
                    zeros = [ElevationSample(p[0], p[1], 0.0, "error", "failed") for p in fallback_chunk]
                    fetched_data.append((chunk_idx, zeros))

        # 4. Integrate Results
        new_cache_entries = []
        
        # Sort by chunk index to maintain order relative to missing_points is NOT strictly needed 
        # if we map back via missing_indices.
        # But fetched_data is unordered.
        # We need to reconstruct the list of results corresponding to missing_points.
        
        # Sort fetched_data by chunk_idx to flatten correctly
        fetched_data.sort(key=lambda x: x[0])
        
        flat_results = []
        for _, samples in fetched_data:
            flat_results.extend(samples)
            
        if len(flat_results) != len(missing_points):
             print(f"GridTiler Error: Mismatch in fetched results count. Expected {len(missing_points)}, got {len(flat_results)}")
             # Logic implies they should match if chunks preserved size.
        
        # Fill final list and prepare cache updates
        for i, sample in enumerate(flat_results):
            original_idx = missing_indices[i]
            final_samples[original_idx] = sample
            
            if sample.quality != "failed":
                new_cache_entries.append((sample.lat, sample.lng, sample.elevation_m, sample.provider))

        # 5. Update Cache
        if new_cache_entries:
            # print(f"GridTiler: Caching {len(new_cache_entries)} new points.")
            self.cache.set_batch(new_cache_entries)
            
        return final_samples
