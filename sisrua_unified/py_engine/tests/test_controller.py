"""
test_controller.py
Testes unitários para controller.py (OSMController).

Cobre: _build_tags, run (success/empty/no-tags), _fetch_features,
_run_audit (auto CRS/exception), _process_terrain, _add_contours,
_export_csv_metadata, _send_geojson_preview.

Coordenadas canônicas: lat=-22.15018, lon=-42.92185 (Muriaé/MG).
"""
import os
import sys
import json
import pytest
from unittest.mock import MagicMock, patch, PropertyMock

import geopandas as gpd
import pandas as pd
import numpy as np
from shapely.geometry import Point, Polygon

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from controller import OSMController
from constants import TEST_LAT, TEST_LON

# ─── helpers ─────────────────────────────────────────────────────────────────

def _make_gdf(crs="EPSG:31983"):
    """Returns a minimal GeoDataFrame with one polygon feature."""
    poly = Polygon([(788547, 7634825), (788647, 7634825),
                    (788647, 7634925), (788547, 7634925)])
    gdf = gpd.GeoDataFrame(
        {
            "geometry": [poly],
            "building": ["yes"],
            "highway": [None],
            "natural": [None],
        },
        crs=crs,
    )
    return gdf


def _make_controller(tmp_path, layers=None, **kwargs):
    if layers is None:
        layers = {"buildings": True, "roads": True, "nature": False}
    out = str(tmp_path / "out.dxf")
    return OSMController(
        lat=TEST_LAT,
        lon=TEST_LON,
        radius=100,
        output_file=out,
        layers_config=layers,
        crs="EPSG:31983",
        **kwargs,
    )


# ─── TestBuildTags ────────────────────────────────────────────────────────────

class TestBuildTags:
    def test_buildings_true(self, tmp_path):
        ctrl = _make_controller(tmp_path, {"buildings": True})
        tags = ctrl._build_tags()
        assert "building" in tags

    def test_roads_true(self, tmp_path):
        ctrl = _make_controller(tmp_path, {"roads": True})
        tags = ctrl._build_tags()
        assert "highway" in tags

    def test_nature_true(self, tmp_path):
        ctrl = _make_controller(tmp_path, {"nature": True})
        tags = ctrl._build_tags()
        assert "natural" in tags
        assert "landuse" in tags

    def test_furniture_with_roads(self, tmp_path):
        """furniture=True with roads=True → highway stays True (all types), amenity added."""
        ctrl = _make_controller(tmp_path, {"furniture": True, "roads": True})
        tags = ctrl._build_tags()
        assert "amenity" in tags
        # highway is True (all types), street_lamp NOT added separately
        assert tags.get("highway") is True

    def test_furniture_without_roads(self, tmp_path):
        """furniture=True without roads → highway becomes ['street_lamp']."""
        ctrl = _make_controller(tmp_path, {"furniture": True, "roads": False})
        tags = ctrl._build_tags()
        assert "highway" in tags
        assert isinstance(tags["highway"], list)
        assert "street_lamp" in tags["highway"]

    def test_furniture_with_road_list(self, tmp_path):
        """furniture=True without roads → highway=['street_lamp'] (else branch)."""
        ctrl = _make_controller(tmp_path, {"roads": False, "furniture": True})
        # roads=False → no 'highway' key initially; furniture=True → else branch adds ['street_lamp']
        tags = ctrl._build_tags()
        assert "street_lamp" in tags.get("highway", [])

    def test_no_tags_returns_empty(self, tmp_path):
        ctrl = _make_controller(tmp_path, {
            "buildings": False, "roads": False, "nature": False, "furniture": False
        })
        tags = ctrl._build_tags()
        assert tags == {}

    def test_all_enabled(self, tmp_path):
        ctrl = _make_controller(tmp_path, {
            "buildings": True, "roads": True, "nature": True, "furniture": True
        })
        tags = ctrl._build_tags()
        assert "building" in tags
        assert "highway" in tags
        assert "natural" in tags
        assert "amenity" in tags

    def test_build_tags_aneel_prodist_adds_power(self, tmp_path):
        """aneel_prodist=True → power=True adicionado às tags (linha 207)."""
        ctrl = _make_controller(tmp_path, {"buildings": True}, aneel_prodist=True)
        tags = ctrl._build_tags()
        assert tags.get('power') is True


# ─── TestRun ─────────────────────────────────────────────────────────────────

class TestRun:
    @patch("controller.fetch_osm_data")
    @patch("controller.run_spatial_audit")
    @patch("controller.DXFGenerator")
    def test_run_empty_tags_raises(self, MockDXF, mock_audit, mock_fetch, tmp_path):
        """run() with no tags selected raises ValueError."""
        ctrl = _make_controller(tmp_path, {
            "buildings": False, "roads": False, "nature": False
        })
        with pytest.raises(ValueError, match="No infrastructure"):
            ctrl.run()

    @patch("controller.fetch_osm_data")
    @patch("controller.run_spatial_audit")
    @patch("controller.DXFGenerator")
    def test_run_empty_gdf_generates_empty_dxf(self, MockDXF, mock_audit, mock_fetch, tmp_path):
        """run() with empty GDF generates an empty DXF with a message."""
        mock_fetch.return_value = gpd.GeoDataFrame()
        mock_dxf_inst = MagicMock()
        MockDXF.return_value = mock_dxf_inst

        ctrl = _make_controller(tmp_path, {"buildings": True})
        ctrl.run()

        mock_dxf_inst.save.assert_called_once()

    @patch("controller.fetch_osm_data")
    @patch("controller.run_spatial_audit")
    @patch("controller.DXFGenerator")
    def test_run_success_path(self, MockDXF, mock_audit, mock_fetch, tmp_path):
        """run() happy path: fetch → audit → add_features → save."""
        gdf = _make_gdf()
        mock_fetch.return_value = gdf
        mock_audit.return_value = ({
            "violations": 0, "coverageScore": 100,
            "powerLineViolations": [], "closestPowerLine": None
        }, gdf.copy())

        mock_dxf_inst = MagicMock()
        mock_dxf_inst.bounds = [788447, 7634725, 788747, 7635025]
        MockDXF.return_value = mock_dxf_inst

        ctrl = _make_controller(tmp_path, {"buildings": True})
        ctrl.run()

        mock_dxf_inst.add_features.assert_called_once_with(gdf)
        mock_dxf_inst.save.assert_called_once()

    @patch("controller.fetch_osm_data")
    @patch("controller.run_spatial_audit")
    @patch("controller.DXFGenerator")
    def test_run_georef_false(self, MockDXF, mock_audit, mock_fetch, tmp_path):
        """run() with georef=False skips setting diff_x/diff_y."""
        gdf = _make_gdf()
        mock_fetch.return_value = gdf
        mock_audit.return_value = (
            {"violations": 0, "coverageScore": 0,
             "powerLineViolations": [], "closestPowerLine": None},
            gdf.copy()
        )
        mock_dxf_inst = MagicMock()
        mock_dxf_inst.bounds = None  # skip cartographic elements
        MockDXF.return_value = mock_dxf_inst

        ctrl = _make_controller(tmp_path, {"buildings": True, "georef": False})
        ctrl.run()

        # diff_x/diff_y were NOT set (no attribute set call) because georef=False
        assert not mock_dxf_inst.diff_x.called

    @patch("controller.fetch_osm_data")
    @patch("controller.run_spatial_audit")
    @patch("controller.DXFGenerator")
    def test_run_with_terrain(self, MockDXF, mock_audit, mock_fetch, tmp_path):
        """run() with terrain=True calls _process_terrain."""
        gdf = _make_gdf()
        mock_fetch.return_value = gdf
        mock_audit.return_value = (
            {"violations": 0, "coverageScore": 0,
             "powerLineViolations": [], "closestPowerLine": None},
            gdf.copy()
        )
        mock_dxf_inst = MagicMock()
        mock_dxf_inst.bounds = None
        MockDXF.return_value = mock_dxf_inst

        ctrl = _make_controller(tmp_path, {"buildings": True, "terrain": True})
        with patch.object(ctrl, "_process_terrain") as mock_terrain:
            ctrl.run()
            mock_terrain.assert_called_once()

    @patch("controller.fetch_osm_data")
    @patch("controller.run_spatial_audit")
    @patch("controller.DXFGenerator")
    def test_run_with_bounds_calls_cartographic(self, MockDXF, mock_audit, mock_fetch, tmp_path):
        """run() when dxf_gen.bounds is not None calls _add_cad_essentials."""
        gdf = _make_gdf()
        mock_fetch.return_value = gdf
        mock_audit.return_value = (
            {"violations": 0, "coverageScore": 0,
             "powerLineViolations": [], "closestPowerLine": None},
            gdf.copy()
        )
        mock_dxf_inst = MagicMock()
        mock_dxf_inst.bounds = [0.0, 0.0, 100.0, 100.0]
        MockDXF.return_value = mock_dxf_inst

        ctrl = _make_controller(tmp_path, {"buildings": True})
        with patch.object(ctrl, "_add_cad_essentials") as mock_cad:
            ctrl.run()
            mock_cad.assert_called_once_with(mock_dxf_inst)


# ─── TestFetchFeatures ────────────────────────────────────────────────────────

class TestFetchFeatures:
    @patch("controller.fetch_osm_data")
    def test_circle_mode(self, mock_fetch, tmp_path):
        """_fetch_features uses circle mode by default."""
        gdf = _make_gdf()
        mock_fetch.return_value = gdf
        ctrl = _make_controller(tmp_path)
        tags = {"building": True}
        result = ctrl._fetch_features(tags)
        mock_fetch.assert_called_once_with(
            TEST_LAT, TEST_LON, 100, tags, crs="EPSG:31983"
        )
        assert result is gdf

    @patch("controller.fetch_osm_data")
    def test_polygon_mode(self, mock_fetch, tmp_path):
        """_fetch_features uses polygon mode when selection_mode='polygon'."""
        gdf = _make_gdf()
        mock_fetch.return_value = gdf
        poly = [[0, 0], [10, 0], [10, 10], [0, 10]]
        ctrl = _make_controller(
            tmp_path, selection_mode="polygon", polygon=poly
        )
        tags = {"building": True}
        ctrl._fetch_features(tags)
        mock_fetch.assert_called_once_with(
            TEST_LAT, TEST_LON, 100, tags, crs="EPSG:31983", polygon=poly
        )

    @patch("controller.fetch_osm_data")
    def test_exception_returns_none(self, mock_fetch, tmp_path):
        """_fetch_features catches exceptions and returns None."""
        mock_fetch.side_effect = RuntimeError("Network error")
        ctrl = _make_controller(tmp_path)
        result = ctrl._fetch_features({"building": True})
        assert result is None


# ─── TestRunAudit ─────────────────────────────────────────────────────────────

class TestRunAudit:
    @patch("controller.run_spatial_audit")
    def test_explicit_crs(self, mock_audit, tmp_path):
        """_run_audit with explicit CRS uses it directly."""
        gdf = _make_gdf()
        mock_audit.return_value = (
            {"violations": 0, "coverageScore": 0,
             "powerLineViolations": [], "closestPowerLine": None},
            gdf.copy()
        )
        ctrl = _make_controller(tmp_path)
        analysis = ctrl._run_audit(gdf)
        mock_audit.assert_called_once_with(gdf)
        assert analysis is not None

    @patch("controller.run_spatial_audit")
    @patch("controller.sirgas2000_utm_epsg")
    def test_auto_crs_selects_sirgas(self, mock_epsg, mock_audit, tmp_path):
        """_run_audit with crs='auto' calls sirgas2000_utm_epsg and uses the result."""
        gdf = _make_gdf()
        mock_epsg.return_value = 31983
        mock_audit.return_value = (
            {"violations": 0, "coverageScore": 0,
             "powerLineViolations": [], "closestPowerLine": None},
            gdf.copy()
        )
        ctrl = _make_controller(tmp_path)
        ctrl.crs = "auto"
        ctrl._run_audit(gdf)
        mock_epsg.assert_called_once()

    @patch("controller.run_spatial_audit")
    def test_exception_returns_none(self, mock_audit, tmp_path):
        """_run_audit catches exceptions and returns None."""
        mock_audit.side_effect = RuntimeError("Audit crash")
        ctrl = _make_controller(tmp_path)
        gdf = _make_gdf()
        result = ctrl._run_audit(gdf)
        assert result is None


# ─── TestProcessTerrain ───────────────────────────────────────────────────────

class TestProcessTerrain:
    @patch("controller.fetch_elevation_grid")
    @patch("controller.generate_contours")
    def test_calls_add_terrain(self, mock_contours, mock_elev, tmp_path):
        """_process_terrain calls dxf_gen.add_terrain_from_grid when elev_points exist."""
        # 4 points → 2x2 grid
        mock_elev.return_value = (
            [(-22.15, -42.92, 820.0), (-22.15, -42.91, 825.0),
             (-22.16, -42.92, 815.0), (-22.16, -42.91, 810.0)],
            2, 2
        )
        mock_contours.return_value = []

        gdf = _make_gdf()
        mock_dxf = MagicMock()
        ctrl = _make_controller(tmp_path, {"buildings": True})
        ctrl._process_terrain(gdf, mock_dxf)
        mock_dxf.add_terrain_from_grid.assert_called_once()

    @patch("controller.fetch_elevation_grid")
    def test_with_contours(self, mock_elev, tmp_path):
        """_process_terrain calls _add_contours when contours=True in layers_config."""
        mock_elev.return_value = (
            [(-22.15, -42.92, 820.0), (-22.15, -42.91, 825.0),
             (-22.16, -42.92, 815.0), (-22.16, -42.91, 810.0)],
            2, 2
        )
        gdf = _make_gdf()
        mock_dxf = MagicMock()
        ctrl = _make_controller(tmp_path, {"buildings": True, "terrain": True, "contours": True})
        with patch.object(ctrl, "_add_contours") as mock_contour_method:
            ctrl._process_terrain(gdf, mock_dxf)
            mock_contour_method.assert_called_once()

    @patch("controller.fetch_elevation_grid")
    def test_exception_is_caught(self, mock_elev, tmp_path):
        """_process_terrain catches exceptions from fetch_elevation_grid."""
        mock_elev.side_effect = RuntimeError("Elevation service down")
        gdf = _make_gdf()
        mock_dxf = MagicMock()
        ctrl = _make_controller(tmp_path)
        # Should not raise
        ctrl._process_terrain(gdf, mock_dxf)
        mock_dxf.add_terrain_from_grid.assert_not_called()

    @patch("controller.fetch_elevation_grid")
    def test_empty_elev_points_skips_terrain(self, mock_elev, tmp_path):
        """_process_terrain skips terrain processing when elev_points is empty."""
        mock_elev.return_value = ([], 0, 0)
        gdf = _make_gdf()
        mock_dxf = MagicMock()
        ctrl = _make_controller(tmp_path)
        ctrl._process_terrain(gdf, mock_dxf)
        mock_dxf.add_terrain_from_grid.assert_not_called()


# ─── TestAddContours ──────────────────────────────────────────────────────────

class TestAddContours:
    @patch("controller.generate_contours")
    def test_calls_add_contour_lines(self, mock_contours, tmp_path):
        """_add_contours calls dxf_gen.add_contour_lines when contours are generated."""
        mock_contours.return_value = [[[0, 0], [10, 0]]]
        grid_rows = [[(0, 0, 820), (10, 0, 825)]]
        mock_dxf = MagicMock()
        ctrl = _make_controller(tmp_path)
        ctrl._add_contours(grid_rows, mock_dxf)
        mock_dxf.add_contour_lines.assert_called_once()

    @patch("controller.generate_contours")
    def test_high_res_contours(self, mock_contours, tmp_path):
        """_add_contours uses interval=0.5 when high_res_contours=True."""
        mock_contours.return_value = []
        grid_rows = []
        mock_dxf = MagicMock()
        ctrl = _make_controller(tmp_path, {"high_res_contours": True})
        ctrl._add_contours(grid_rows, mock_dxf)
        mock_contours.assert_called_once_with(grid_rows, interval=0.5)

    @patch("controller.generate_contours")
    def test_exception_is_caught(self, mock_contours, tmp_path):
        """_add_contours catches math errors without raising."""
        mock_contours.side_effect = RuntimeError("Math failure")
        mock_dxf = MagicMock()
        ctrl = _make_controller(tmp_path)
        # Should not raise
        ctrl._add_contours([], mock_dxf)


# ─── TestExportCsvMetadata ────────────────────────────────────────────────────

class TestExportCsvMetadata:
    def test_creates_csv_file(self, tmp_path):
        """_export_csv_metadata creates a _metadata.csv alongside the DXF."""
        gdf = _make_gdf()
        ctrl = _make_controller(tmp_path)
        ctrl._export_csv_metadata(gdf)
        expected_csv = str(tmp_path / "out_metadata.csv")
        assert os.path.exists(expected_csv)

    def test_exception_is_caught(self, tmp_path):
        """_export_csv_metadata catches exceptions without raising."""
        ctrl = _make_controller(tmp_path)
        # Pass an invalid GDF that will raise on copy()
        broken_gdf = MagicMock()
        broken_gdf.copy.side_effect = RuntimeError("File I/O error")
        # Should not raise
        ctrl._export_csv_metadata(broken_gdf)


# ─── TestSendGeoJsonPreview ───────────────────────────────────────────────────

class TestSendGeoJsonPreview:
    def test_skips_when_skip_geojson_true(self, tmp_path):
        """_send_geojson_preview is a no-op when Logger.SKIP_GEOJSON=True."""
        from utils.logger import Logger
        original = Logger.SKIP_GEOJSON
        try:
            Logger.SKIP_GEOJSON = True
            ctrl = _make_controller(tmp_path)
            gdf = _make_gdf()
            # Should not raise or call Logger.geojson
            with patch("controller.Logger") as mock_logger:
                ctrl._send_geojson_preview(gdf)
                mock_logger.geojson.assert_not_called()
        finally:
            Logger.SKIP_GEOJSON = original

    def test_sends_geojson_with_analysis(self, tmp_path):
        """_send_geojson_preview merges analysis_gdf features into payload."""
        from utils.logger import Logger
        original = Logger.SKIP_GEOJSON
        try:
            Logger.SKIP_GEOJSON = False
            ctrl = _make_controller(tmp_path)
            gdf = _make_gdf()
            analysis = _make_gdf(crs="EPSG:31983")
            with patch("controller.Logger") as mock_logger:
                # Ensure SKIP_GEOJSON is falsy so the guard doesn't short-circuit
                mock_logger.SKIP_GEOJSON = False
                ctrl._send_geojson_preview(gdf, analysis_gdf=analysis)
                mock_logger.geojson.assert_called_once()
                payload = mock_logger.geojson.call_args[0][0]
                assert "features" in payload
        finally:
            Logger.SKIP_GEOJSON = original

    def test_exception_is_caught(self, tmp_path):
        """_send_geojson_preview catches exceptions without raising."""
        ctrl = _make_controller(tmp_path)
        broken = MagicMock()
        broken.copy.side_effect = RuntimeError("Serialization error")
        # Should not raise
        ctrl._send_geojson_preview(broken)


# ─── TestAddCadEssentials ─────────────────────────────────────────────────────

class TestAddCadEssentials:
    def test_calls_grid_and_cartographic(self, tmp_path):
        """_add_cad_essentials calls both add_coordinate_grid and add_cartographic_elements."""
        ctrl = _make_controller(tmp_path)
        mock_dxf = MagicMock()
        mock_dxf.bounds = [0.0, 0.0, 100.0, 100.0]
        mock_dxf.diff_x = 0.0
        mock_dxf.diff_y = 0.0
        ctrl._add_cad_essentials(mock_dxf)
        mock_dxf.add_coordinate_grid.assert_called_once_with(0.0, 0.0, 100.0, 100.0, 0.0, 0.0)
        mock_dxf.add_cartographic_elements.assert_called_once_with(0.0, 0.0, 100.0, 100.0, 0.0, 0.0)
