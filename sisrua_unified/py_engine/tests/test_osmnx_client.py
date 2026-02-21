"""
Tests for osmnx_client.py — OSM data fetching with chunked strategy for large areas.
All tests are fully offline (no real network calls) using mocks.
"""
import sys
import os
import pytest
import geopandas as gpd
import pandas as pd
from shapely.geometry import Point
from unittest.mock import patch, MagicMock, call

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from osmnx_client import (
    fetch_osm_data,
    _fetch_chunked,
    _intersect_tags,
    _project_gdf,
    LARGE_RADIUS_THRESHOLD_METERS,
    _CHUNK_TAG_GROUPS,
)
from constants import TEST_LAT, TEST_LON, MAX_FETCH_RADIUS_METERS


def _make_gdf(num_features=3, crs='EPSG:4326'):
    """Helper that creates a minimal GeoDataFrame with num_features Point features."""
    geoms = [Point(TEST_LON + i * 0.001, TEST_LAT + i * 0.001) for i in range(num_features)]
    return gpd.GeoDataFrame({'geometry': geoms}, crs=crs)


class TestIntersectTags:
    def test_returns_matching_keys(self):
        requested = {'building': True, 'highway': True, 'leisure': True}
        group = {'building': True, 'leisure': True}
        result = _intersect_tags(requested, group)
        assert set(result.keys()) == {'building', 'leisure'}

    def test_returns_empty_when_no_match(self):
        result = _intersect_tags({'building': True}, {'highway': True})
        assert result == {}

    def test_returns_empty_for_empty_inputs(self):
        assert _intersect_tags({}, {'building': True}) == {}
        assert _intersect_tags({'building': True}, {}) == {}


class TestProjectGdf:
    def test_auto_crs_calls_ox_project(self):
        gdf = _make_gdf()
        with patch('osmnx_client.ox.projection.project_gdf', return_value=gdf) as mock_proj:
            result = _project_gdf(gdf, 'auto')
            mock_proj.assert_called_once_with(gdf)

    def test_explicit_crs_reprojects(self):
        gdf = _make_gdf()
        projected = _make_gdf(crs='EPSG:32723')
        with patch.object(gdf, 'to_crs', return_value=projected) as mock_to_crs:
            result = _project_gdf(gdf, 'EPSG:32723')
            mock_to_crs.assert_called_once_with('EPSG:32723')
            assert result is projected

    def test_fallback_to_auto_on_crs_error(self):
        gdf = _make_gdf()
        auto_projected = _make_gdf(crs='EPSG:32723')
        with patch.object(gdf, 'to_crs', side_effect=Exception("bad crs")):
            with patch('osmnx_client.ox.projection.project_gdf', return_value=auto_projected) as mock_proj:
                result = _project_gdf(gdf, 'EPSG:9999')
                mock_proj.assert_called_once_with(gdf)
                assert result is auto_projected


class TestFetchChunked:
    """Unit tests for the chunked fetch strategy (no real network calls)."""

    def test_merges_results_from_multiple_chunks(self):
        chunk_a = _make_gdf(2)
        chunk_b = _make_gdf(3)

        call_count = [0]

        def fake_features_from_point(center, tags, dist):
            call_count[0] += 1
            if 'building' in tags:
                return chunk_a
            if 'highway' in tags:
                return chunk_b
            return gpd.GeoDataFrame()

        with patch('osmnx_client.ox.features.features_from_point', side_effect=fake_features_from_point):
            tags = {'building': True, 'highway': True}
            result = _fetch_chunked(TEST_LAT, TEST_LON, 1500, tags)

        assert len(result) >= 2

    def test_returns_empty_gdf_when_all_chunks_empty(self):
        with patch('osmnx_client.ox.features.features_from_point', return_value=gpd.GeoDataFrame()):
            result = _fetch_chunked(TEST_LAT, TEST_LON, 2000, {'building': True})
        assert result.empty

    def test_skips_chunk_on_error_and_continues(self):
        good_chunk = _make_gdf(4)

        def raise_on_highway(center, tags, dist):
            if 'highway' in tags:
                raise Exception("Overpass timeout")
            return good_chunk

        with patch('osmnx_client.ox.features.features_from_point', side_effect=raise_on_highway):
            result = _fetch_chunked(TEST_LAT, TEST_LON, 1500, {'building': True, 'highway': True})

        # Should still return features from the successful chunk
        assert not result.empty

    def test_deduplicates_by_index(self):
        # Same GDF returned for both chunks → duplicates should be removed
        shared_gdf = _make_gdf(3)

        with patch('osmnx_client.ox.features.features_from_point', return_value=shared_gdf):
            result = _fetch_chunked(TEST_LAT, TEST_LON, 1500, {'building': True, 'highway': True})

        assert len(result) == len(shared_gdf)

    def test_handles_extra_tags_not_in_predefined_groups(self):
        base_gdf = _make_gdf(1)
        extra_gdf = _make_gdf(2)

        def fake_fetch(center, tags, dist):
            if 'custom_tag' in tags:
                return extra_gdf
            return base_gdf

        with patch('osmnx_client.ox.features.features_from_point', side_effect=fake_fetch):
            result = _fetch_chunked(TEST_LAT, TEST_LON, 2000, {'building': True, 'custom_tag': True})

        assert not result.empty


class TestFetchOsmData:
    """Integration-style tests for fetch_osm_data (mocked network)."""

    def _auto_proj(self, gdf):
        return gdf.to_crs('EPSG:32723') if gdf.crs else gdf

    def test_small_radius_uses_single_query(self):
        gdf = _make_gdf()
        with patch('osmnx_client.ox.features.features_from_point', return_value=gdf) as mock_fetch, \
             patch('osmnx_client._fetch_chunked') as mock_chunked, \
             patch('osmnx_client.ox.projection.project_gdf', return_value=gdf):
            result = fetch_osm_data(TEST_LAT, TEST_LON, 500, {'building': True})
            mock_fetch.assert_called_once()
            mock_chunked.assert_not_called()

    def test_large_radius_uses_chunked_fetch(self):
        gdf = _make_gdf()
        with patch('osmnx_client._fetch_chunked', return_value=gdf) as mock_chunked, \
             patch('osmnx_client.ox.projection.project_gdf', return_value=gdf):
            fetch_osm_data(TEST_LAT, TEST_LON, LARGE_RADIUS_THRESHOLD_METERS + 1, {'building': True})
            mock_chunked.assert_called_once()

    def test_radius_at_threshold_uses_single_query(self):
        gdf = _make_gdf()
        with patch('osmnx_client.ox.features.features_from_point', return_value=gdf) as mock_fetch, \
             patch('osmnx_client._fetch_chunked') as mock_chunked, \
             patch('osmnx_client.ox.projection.project_gdf', return_value=gdf):
            fetch_osm_data(TEST_LAT, TEST_LON, LARGE_RADIUS_THRESHOLD_METERS, {'building': True})
            mock_fetch.assert_called_once()
            mock_chunked.assert_not_called()

    def test_polygon_mode_bypasses_radius_check(self):
        gdf = _make_gdf()
        polygon = [[TEST_LAT, TEST_LON], [TEST_LAT + 0.01, TEST_LON], [TEST_LAT, TEST_LON + 0.01]]
        with patch('osmnx_client.ox.features.features_from_polygon', return_value=gdf) as mock_poly, \
             patch('osmnx_client._fetch_chunked') as mock_chunked, \
             patch('osmnx_client.ox.projection.project_gdf', return_value=gdf):
            fetch_osm_data(TEST_LAT, TEST_LON, 9999, {'building': True}, polygon=polygon)
            mock_poly.assert_called_once()
            mock_chunked.assert_not_called()

    def test_raises_when_radius_exceeds_max(self):
        with pytest.raises(ValueError, match="Radius too large"):
            fetch_osm_data(TEST_LAT, TEST_LON, MAX_FETCH_RADIUS_METERS + 1, {'building': True})

    def test_returns_empty_gdf_when_no_features(self):
        with patch('osmnx_client.ox.features.features_from_point', return_value=gpd.GeoDataFrame()):
            result = fetch_osm_data(TEST_LAT, TEST_LON, 100, {'building': True})
        assert result.empty

    def test_raises_on_fetch_error(self):
        with patch('osmnx_client.ox.features.features_from_point', side_effect=Exception("network error")):
            with pytest.raises(Exception, match="network error"):
                fetch_osm_data(TEST_LAT, TEST_LON, 100, {'building': True})

    def test_canonical_coordinates_small_radius(self):
        """Sanity test using canonical test coordinates (100m radius)."""
        gdf = _make_gdf(5)
        with patch('osmnx_client.ox.features.features_from_point', return_value=gdf), \
             patch('osmnx_client.ox.projection.project_gdf', return_value=gdf):
            result = fetch_osm_data(TEST_LAT, TEST_LON, 100, {'building': True})
        assert not result.empty

    def test_canonical_coordinates_large_radius(self):
        """Sanity test using canonical test coordinates (1km+ radius — chunked path)."""
        gdf = _make_gdf(10)
        with patch('osmnx_client._fetch_chunked', return_value=gdf), \
             patch('osmnx_client.ox.projection.project_gdf', return_value=gdf):
            result = fetch_osm_data(TEST_LAT, TEST_LON, LARGE_RADIUS_THRESHOLD_METERS + 1, {'building': True, 'highway': True})
        assert not result.empty
