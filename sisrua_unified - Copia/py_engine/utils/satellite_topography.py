import os
import time
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple

import requests


@dataclass(frozen=True)
class ElevationSample:
    lat: float
    lng: float
    elevation_m: float
    provider: str
    quality: str = "measured"


class ElevationProviderError(RuntimeError):
    def __init__(self, provider: str, message: str) -> None:
        super().__init__(f"{provider}: {message}")
        self.provider = provider
        self.message = message


class ElevationProvider:
    name: str

    def is_available(self) -> bool:
        return True

    def sample(self, lat: float, lng: float) -> ElevationSample:
        raise NotImplementedError

    def sample_batch(self, points: List[Tuple[float, float]]) -> List[ElevationSample]:
        # Default implementation: sequential
        return [self.sample(lat, lng) for lat, lng in points]


class MapboxTerrainProvider(ElevationProvider):
    name = "mapbox"

    def __init__(self, token: Optional[str] = None, timeout_seconds: int = 10) -> None:
        self.token = token or os.getenv("MAPBOX_TOKEN")
        self.timeout_seconds = int(os.getenv("SATELLITE_REQUEST_TIMEOUT", str(timeout_seconds)))

    def is_available(self) -> bool:
        return bool(self.token)

    def sample(self, lat: float, lng: float) -> ElevationSample:
        if not self.token:
            raise ElevationProviderError(self.name, "MAPBOX_TOKEN is missing")

        url = (
            f"https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/"
            f"{lng},{lat}.json?layers=contour&limit=1&access_token={self.token}"
        )
        response = _request_with_retry(url=url, timeout_seconds=self.timeout_seconds)
        response.raise_for_status()
        data = response.json()

        features = data.get("features", [])
        if not features:
            raise ElevationProviderError(self.name, "Mapbox returned no terrain feature")

        contour = features[0].get("properties", {}).get("ele")
        if contour is None:
            raise ElevationProviderError(self.name, "Mapbox response missing contour elevation")

        return ElevationSample(lat=lat, lng=lng, elevation_m=float(contour), provider=self.name, quality="measured")

    def sample_batch(self, points: List[Tuple[float, float]]) -> List[ElevationSample]:
        # Mapbox TileQuery doesn't support batch, so we use ThreadPoolExecutor to speed up
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        results = [None] * len(points)
        with ThreadPoolExecutor(max_workers=10) as executor:
            future_to_idx = {
                executor.submit(self.sample, lat, lng): i 
                for i, (lat, lng) in enumerate(points)
            }
            for future in as_completed(future_to_idx):
                idx = future_to_idx[future]
                try:
                    results[idx] = future.result()
                except Exception as e:
                    # If one fails, we can't easily fallback the whole batch in this architecture 
                    # without complex logic. For now, raise or return None?
                    # Raising allows the batch_fallback to try next provider.
                    raise e
        return results


class OpenTopoDataProvider(ElevationProvider):
    name = "opentopodata"

    def __init__(self, dataset: str = "aster30m", timeout_seconds: int = 10) -> None:
        self.dataset = dataset
        self.timeout_seconds = int(os.getenv("SATELLITE_REQUEST_TIMEOUT", str(timeout_seconds)))

    def sample(self, lat: float, lng: float) -> ElevationSample:
        url = f"https://api.opentopodata.org/v1/{self.dataset}?locations={lat},{lng}"
        response = _request_with_retry(url=url, timeout_seconds=self.timeout_seconds)
        response.raise_for_status()
        payload = response.json()
        results = payload.get("results", [])
        if not results or results[0].get("elevation") is None:
            raise ElevationProviderError(self.name, "OpenTopoData returned no elevation")

        elevation = float(results[0]["elevation"])
        return ElevationSample(lat=lat, lng=lng, elevation_m=elevation, provider=self.name, quality="measured")

    def sample_batch(self, points: List[Tuple[float, float]]) -> List[ElevationSample]:
        # Batch support via pipe-separated locations
        # URL length limit is usually ~2000 chars. 100 points might fit. 
        # Lat/Lng is approx 20 chars. 100 * 20 = 2000. It's tight.
        # We should chunk it.
        chunk_size = 50
        all_samples = []
        
        for i in range(0, len(points), chunk_size):
            chunk = points[i:i+chunk_size]
            locations = "|".join(f"{lat},{lng}" for lat, lng in chunk)
            url = f"https://api.opentopodata.org/v1/{self.dataset}?locations={locations}"
            
            response = _request_with_retry(url=url, timeout_seconds=self.timeout_seconds)
            response.raise_for_status()
            payload = response.json()
            results = payload.get("results", [])
            
            if len(results) != len(chunk):
                raise ElevationProviderError(self.name, f"OpenTopoData returned {len(results)} results for {len(chunk)} points")
                
            for j, res in enumerate(results):
                ele = res.get("elevation")
                if ele is None:
                    raise ElevationProviderError(self.name, f"Missing elevation at index {j}")
                all_samples.append(ElevationSample(
                    lat=chunk[j][0], lng=chunk[j][1], 
                    elevation_m=float(ele), provider=self.name, quality="measured"
                ))
                
        return all_samples


class OpenElevationProvider(ElevationProvider):
    name = "open-elevation"

    def __init__(self, base_url: Optional[str] = None, timeout_seconds: int = 10) -> None:
        self.base_url = (base_url or os.getenv("OPEN_ELEVATION_URL") or "https://api.open-elevation.com/api/v1/lookup").rstrip("/")
        self.timeout_seconds = int(os.getenv("SATELLITE_REQUEST_TIMEOUT", str(timeout_seconds)))

    def sample(self, lat: float, lng: float) -> ElevationSample:
        response = _request_with_retry(
            url=self.base_url,
            params={"locations": f"{lat},{lng}"},
            timeout_seconds=self.timeout_seconds,
        )
        response.raise_for_status()
        data = response.json()
        results = data.get("results", [])
        if not results or results[0].get("elevation") is None:
            raise ElevationProviderError(self.name, "Open-Elevation returned no elevation")

        elevation = float(results[0]["elevation"])
        return ElevationSample(lat=lat, lng=lng, elevation_m=elevation, provider=self.name, quality="measured")

    def sample_batch(self, points: List[Tuple[float, float]]) -> List[ElevationSample]:
        from concurrent.futures import ThreadPoolExecutor, as_completed

        # JSON POST is better for batch
        # Open-Elevation supports POST: {"locations": [{"latitude": 10, "longitude": 10}, ...]}
        
        chunk_size = 200 # Conservative batch size for free API
        sys_priority = os.getenv("SATELLITE_PROVIDER_PRIORITY", "")
        # Use concurrent requests if Open-Elevation is prioritized, otherwise be conservative
        max_workers = 4 if "open-elevation" in sys_priority else 2
        
        chunks = [points[i:i+chunk_size] for i in range(0, len(points), chunk_size)]
        all_samples = [None] * len(points)
        
        # Helper to process a chunk and return (start_index, results)
        def process_chunk(start_idx, chunk_points):
            payload = {
                "locations": [{"latitude": lat, "longitude": lng} for lat, lng in chunk_points]
            }
            try:
                # Increased timeout for batch
                response = requests.post(self.base_url, json=payload, timeout=self.timeout_seconds * 3)
                response.raise_for_status()
                data = response.json()
            except Exception as e:
                raise ElevationProviderError(self.name, f"Batch POST failed for chunk starting at {start_idx}: {e}")

            results = data.get("results", [])
            if len(results) != len(chunk_points):
                 raise ElevationProviderError(self.name, "Open-Elevation returned mismatch count")
            
            parsed = []
            for j, res in enumerate(results):
                 ele = res.get("elevation")
                 parsed.append(ElevationSample(
                    lat=chunk_points[j][0], lng=chunk_points[j][1], 
                    elevation_m=float(ele) if ele is not None else 0.0,
                    provider=self.name, 
                    quality="measured"
                ))
            return start_idx, parsed

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_chunk = {
                executor.submit(process_chunk, i * chunk_size, chunk): i * chunk_size 
                for i, chunk in enumerate(chunks)
            }
            
            for future in as_completed(future_to_chunk):
                try:
                    start_idx, parsed_samples = future.result()
                    # Place results in correct order
                    for k, sample in enumerate(parsed_samples):
                        all_samples[start_idx + k] = sample
                except Exception as e:
                     raise e
                
        return all_samples


def _request_with_retry(
    url: str,
    timeout_seconds: int,
    params: Optional[Dict] = None,
    max_attempts: int = 1,
) -> requests.Response:
    configured_attempts = int(os.getenv("SATELLITE_REQUEST_ATTEMPTS", str(max_attempts)))
    max_attempts = max(1, configured_attempts)
    last_exception: Optional[Exception] = None
    for attempt in range(1, max_attempts + 1):
        try:
            return requests.get(url, params=params, timeout=timeout_seconds)
        except requests.RequestException as exc:
            last_exception = exc
            if attempt < max_attempts:
                time.sleep(0.3 * attempt)
    raise RuntimeError(f"Request failed after {max_attempts} attempts: {last_exception}")


def _provider_catalog() -> Dict[str, ElevationProvider]:
    return {
        "mapbox": MapboxTerrainProvider(),
        "opentopodata": OpenTopoDataProvider(),
        "open-elevation": OpenElevationProvider(),
    }


def _priority_list() -> List[str]:
    raw = os.getenv("SATELLITE_PROVIDER_PRIORITY", "mapbox,opentopodata,open-elevation")
    return [item.strip().lower() for item in raw.split(",") if item.strip()]


def get_provider_status() -> Dict[str, Dict[str, object]]:
    providers = _provider_catalog()
    priority = _priority_list()
    status: Dict[str, Dict[str, object]] = {}
    for name, provider in providers.items():
        status[name] = {
            "available": provider.is_available(),
            "priority": priority.index(name) if name in priority else None,
        }
    return status


def sample_elevation_with_fallback(lat: float, lng: float) -> ElevationSample:
    providers = _provider_catalog()
    last_error: Optional[Exception] = None

    for provider_name in _priority_list():
        provider = providers.get(provider_name)
        if not provider:
            continue
        if not provider.is_available():
            continue
        try:
            return provider.sample(lat, lng)
        except Exception as exc:
            last_error = exc

    if last_error:
        raise RuntimeError(f"All providers failed. Last error: {last_error}")
    raise RuntimeError("No elevation provider available. Check SATELLITE_PROVIDER_PRIORITY and credentials.")


def sample_elevation_batch(points: List[Tuple[float, float]]) -> List[ElevationSample]:
    """Sample elevation for multiple points with provider fallback strategy."""
    providers = _provider_catalog()
    last_error: Optional[Exception] = None

    for provider_name in _priority_list():
        provider = providers.get(provider_name)
        if not provider:
            continue
        if not provider.is_available():
            continue
        try:
            return provider.sample_batch(points)
        except Exception as exc:
            last_error = exc
            # Print warning or log?
            print(f"Provider {provider_name} failed batch: {exc}")

    if last_error:
        raise RuntimeError(f"All providers failed batch. Last error: {last_error}")
    raise RuntimeError("No elevation provider available for batch.")


def sample_grid(center_lat: float, center_lng: float, offsets: Iterable[Tuple[float, float]]) -> List[ElevationSample]:
    # Optimized to use batch
    points = []
    for delta_lat, delta_lng in offsets:
        lat = center_lat + delta_lat
        lng = center_lng + delta_lng
        points.append((lat, lng))
        
    return sample_elevation_batch(points)