import pytest
import geopandas as gpd
from shapely.geometry import Point, LineString, Polygon
from unittest.mock import patch
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from spatial_audit import (
    run_spatial_audit,
    _combine_analysis_features,
    _calculate_lighting_score,
    _audit_power_line_proximity,
)

def test_spatial_audit_no_data():
    """Test audit with empty GDF."""
    gdf = gpd.GeoDataFrame()
    summary, analysis_gdf = run_spatial_audit(gdf)
    assert summary == {}
    assert analysis_gdf.empty

def test_violation_detection():
    """Test detection of building inside power line buffer."""
    # Power line (LineString)
    pl = LineString([(0,0), (10,0)])
    # Building inside (5m buffer)
    b_inside = Polygon([(5,1), (6,1), (6,2), (5,2)])
    # Building outside
    b_outside = Polygon([(5,10), (6,10), (6,11), (5,11)])
    
    data = {
        'geometry': [pl, b_inside, b_outside],
        'power': ['line', None, None],
        'building': [None, True, True]
    }
    gdf = gpd.GeoDataFrame(data, crs="EPSG:3857")
    
    summary, analysis_gdf = run_spatial_audit(gdf)
    
    assert summary['violations'] == 1
    assert 'violations_list' in summary
    violations = summary['violations_list']
    assert len(violations) == 1
    assert violations[0]['type'] == 'proximity'
    assert "within 5.0m of power line" in violations[0]['description']
    # Check coordinate propagation (within building bounds approx)
    assert isinstance(violations[0]['lat'], float)
    assert isinstance(violations[0]['lon'], float)
    
    assert 'analysis_type' in analysis_gdf.columns
    assert len(analysis_gdf[analysis_gdf['analysis_type'] == 'buffer']) == 1

def test_lighting_coverage():
    """Test lighting coverage score calculation."""
    # Road of 100m
    road = LineString([(0,0), (100,0)])
    # 2 lamps (Ideal is 100/30 = 3.33)
    # Score should be (2 / 3.33) * 100 approx 60%
    lamp1 = Point(10, 0)
    lamp2 = Point(40, 0)
    
    data = {
        'geometry': [road, lamp1, lamp2],
        'feature_type': ['highway', 'lamp', 'lamp'],
        'highway': ['residential', 'street_lamp', 'street_lamp']
    }
    gdf = gpd.GeoDataFrame(data)
    
    summary, _ = run_spatial_audit(gdf)
    
    assert 50 < summary['coverageScore'] < 70
    assert summary['violations'] == 0

def test_analysis_layers_output():
    """Test if analysis features are correctly generated."""
    lamp = Point(0,0)
    data = {
        'geometry': [lamp],
        'highway': ['street_lamp']
    }
    gdf = gpd.GeoDataFrame(data)
    
    _, analysis_gdf = run_spatial_audit(gdf)
    
    assert not analysis_gdf.empty
    assert analysis_gdf.iloc[0]['analysis_type'] == 'coverage'
    # Check if buffer radius is correct (15m radius circle area approx 706)
    assert 700 < analysis_gdf.iloc[0].geometry.area < 710


# ─── Testes das funções auxiliares internas ───────────────────────────────────

class TestCombineAnalysisFeatures:
    """Testa _combine_analysis_features — fusão de GeoDataFrames de auditoria."""

    def test_empty_list_returns_empty_gdf(self):
        """Lista vazia deve retornar GeoDataFrame vazio com coluna geometry."""
        result = _combine_analysis_features([], 'EPSG:3857')
        assert result.empty
        assert 'geometry' in result.columns

    def test_single_frame_returned(self):
        """Lista com um frame deve retornar esse frame."""
        gdf = gpd.GeoDataFrame(
            {'geometry': [Point(0, 0)], 'analysis_type': ['buffer']},
            crs='EPSG:3857'
        )
        result = _combine_analysis_features([gdf], 'EPSG:3857')
        assert len(result) == 1
        assert result.iloc[0]['analysis_type'] == 'buffer'

    def test_multiple_frames_concatenated(self):
        """Múltiplos frames devem ser concatenados."""
        gdf1 = gpd.GeoDataFrame(
            {'geometry': [Point(0, 0)], 'analysis_type': ['buffer']},
            crs='EPSG:3857'
        )
        gdf2 = gpd.GeoDataFrame(
            {'geometry': [Point(10, 10)], 'analysis_type': ['coverage']},
            crs='EPSG:3857'
        )
        result = _combine_analysis_features([gdf1, gdf2], 'EPSG:3857')
        assert len(result) == 2

    def test_concat_exception_triggers_fallback(self):
        """Erro na concatenação deve acionar fallback (primeiro frame da lista)."""
        gdf1 = gpd.GeoDataFrame(
            {'geometry': [Point(0, 0)], 'analysis_type': ['buffer']},
            crs='EPSG:3857'
        )
        gdf2 = gpd.GeoDataFrame(
            {'geometry': [Point(10, 10)], 'analysis_type': ['coverage']},
            crs='EPSG:3857'
        )
        # Simular falha explícita no pd.concat para cobrir o bloco except (linhas 129-131)
        with patch('geopandas.pd.concat', side_effect=ValueError('simulado: concat falhou')):
            result = _combine_analysis_features([gdf1, gdf2], 'EPSG:3857')
        # Fallback retorna o primeiro elemento da lista
        assert len(result) == 1
        assert result.iloc[0]['analysis_type'] == 'buffer'


class TestCalculateLightingScore:
    """Testa _calculate_lighting_score — pontuação de cobertura de iluminação."""

    def test_empty_roads_returns_zero(self):
        """Roads GDF vazio deve retornar score 0."""
        roads = gpd.GeoDataFrame({'geometry': []})
        lamps = gpd.GeoDataFrame({'geometry': [Point(0, 0)]})
        score = _calculate_lighting_score(roads, lamps)
        assert score == 0

    def test_zero_total_road_length_returns_zero(self):
        """Roads com comprimento total zero (ex: apenas pontos) deve retornar score 0."""
        # Points têm comprimento 0
        roads = gpd.GeoDataFrame({'geometry': [Point(0, 0), Point(10, 0)]})
        lamps = gpd.GeoDataFrame({'geometry': [Point(5, 0)]})
        score = _calculate_lighting_score(roads, lamps)
        assert score == 0

    def test_score_capped_at_100(self):
        """Score nunca deve exceder 100, mesmo com muitas lâmpadas."""
        road = LineString([(0, 0), (30, 0)])  # 30m → ideal = 1 lâmpada
        roads = gpd.GeoDataFrame({'geometry': [road]})
        # 10 lâmpadas → score bruto > 100, mas deve ser capado em 100
        lamps = gpd.GeoDataFrame({'geometry': [Point(i * 3, 0) for i in range(10)]})
        score = _calculate_lighting_score(roads, lamps)
        assert score == 100

    def test_proportional_score(self):
        """Score proporcional ao número de lâmpadas relativo ao ideal."""
        road = LineString([(0, 0), (300, 0)])  # 300m → ideal = 10 lâmpadas
        roads = gpd.GeoDataFrame({'geometry': [road]})
        lamps = gpd.GeoDataFrame({'geometry': [Point(0, 0), Point(30, 0)]})  # 2 de 10
        score = _calculate_lighting_score(roads, lamps)
        assert 15 < score < 25  # ~20%


class TestAuditPowerLineProximity:
    """Testa _audit_power_line_proximity — exceção no caminho de erro."""

    def test_exception_returns_zero_and_none(self):
        """Erro durante a auditoria deve retornar (0, [], None)."""
        power_lines = gpd.GeoDataFrame(
            {'geometry': [LineString([(0, 0), (10, 0)])], 'power': ['line']},
            crs='EPSG:3857'
        )
        # Buildings sem CRS → to_crs(4326) vai lançar exceção
        buildings = gpd.GeoDataFrame(
            {'geometry': [Polygon([(5, 1), (6, 1), (6, 2), (5, 2)])], 'building': [True]}
        )
        violations, vlist, buf = _audit_power_line_proximity(power_lines, buildings, 'EPSG:3857')
        assert violations == 0
        assert vlist == []
        assert buf is None


class TestRunSpatialAuditEdgeCases:
    """Testa run_spatial_audit com dados que cobrem branches específicos."""

    def test_only_buildings_no_lamps_no_powerlines(self):
        """GDF só com edificações → análise vazia, combine_analysis com lista vazia."""
        poly = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        gdf = gpd.GeoDataFrame({'geometry': [poly], 'building': [True]}, crs='EPSG:3857')
        summary, analysis_gdf = run_spatial_audit(gdf)
        assert summary['violations'] == 0
        assert analysis_gdf.empty

    def test_only_roads_no_lamps(self):
        """GDF só com vias (feature_type=highway) → cobertura=0, análise vazia."""
        road = LineString([(0, 0), (100, 0)])
        gdf = gpd.GeoDataFrame(
            {'geometry': [road], 'feature_type': ['highway']},
        )
        summary, analysis_gdf = run_spatial_audit(gdf)
        assert summary['coverageScore'] == 0
        assert analysis_gdf.empty

    def test_degenerate_road_zero_length_score(self):
        """Linha degenerada (comprimento = 0) retorna coverageScore = 0."""
        degenerate = LineString([(5, 5), (5, 5)])  # Ponto, comprimento = 0
        lamp = Point(5, 5)
        gdf = gpd.GeoDataFrame(
            {
                'geometry': [degenerate, lamp],
                'feature_type': ['highway', 'lamp'],
                'highway': ['residential', 'street_lamp'],
            }
        )
        summary, _ = run_spatial_audit(gdf)
        assert summary['coverageScore'] == 0

