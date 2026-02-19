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


def sample_grid(center_lat: float, center_lng: float, offsets: Iterable[Tuple[float, float]]) -> List[ElevationSample]:
    samples: List[ElevationSample] = []
    for delta_lat, delta_lng in offsets:
        lat = center_lat + delta_lat
        lng = center_lng + delta_lng
        samples.append(sample_elevation_with_fallback(lat, lng))
    return samples