"""
Testes unitários para contour_generator.py

Cobre: generate_contours — entrada plana, com relevo, e casos de erro.
"""
import sys
import os
import pytest
import numpy as np

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contour_generator import generate_contours


def _make_grid(rows, cols, base_z=0.0, slope=1.0):
    """Cria uma grade regular rows x cols com Z variando linearmente."""
    grid = []
    for r in range(rows):
        row = []
        for c in range(cols):
            x = float(c * 10)
            y = float(r * 10)
            z = base_z + slope * (r + c)
            row.append((x, y, z))
        grid.append(row)
    return grid


class TestGenerateContours:
    def test_flat_terrain_returns_empty(self):
        """Terreno completamente plano não deve gerar curvas de nível."""
        grid = _make_grid(5, 5, base_z=100.0, slope=0.0)
        result = generate_contours(grid, interval=1.0)
        assert result == []

    def test_sloped_terrain_generates_contours(self):
        """Terreno com variação de elevação deve gerar ao menos uma curva."""
        grid = _make_grid(10, 10, base_z=0.0, slope=2.0)
        result = generate_contours(grid, interval=5.0)
        assert isinstance(result, list)
        assert len(result) > 0

    def test_contour_points_are_3d_tuples(self):
        """Cada ponto de contorno deve ser uma tupla de 3 floats (x, y, z)."""
        grid = _make_grid(8, 8, base_z=0.0, slope=3.0)
        result = generate_contours(grid, interval=5.0)
        for polyline in result:
            assert len(polyline) > 1, "Polyline deve ter pelo menos 2 pontos"
            for pt in polyline:
                assert len(pt) == 3, f"Ponto deve ter 3 coordenadas, got {len(pt)}"
                x, y, z = pt
                assert isinstance(x, (int, float))
                assert isinstance(y, (int, float))
                assert isinstance(z, (int, float))

    def test_small_interval_generates_more_contours(self):
        """Intervalo menor deve gerar mais (ou igual) curvas de nível."""
        grid = _make_grid(10, 10, base_z=0.0, slope=2.0)
        result_fine = generate_contours(grid, interval=1.0)
        result_coarse = generate_contours(grid, interval=5.0)
        assert len(result_fine) >= len(result_coarse)

    def test_returns_empty_on_invalid_grid(self):
        """Grade inválida (vazia) deve retornar lista vazia sem lançar exceção."""
        result = generate_contours([], interval=1.0)
        assert result == []

    def test_returns_empty_on_exception(self):
        """Entrada com estrutura inconsistente deve retornar lista vazia (via except)."""
        bad_grid = [[(0, 0, 0), (1, 1, 10)], [(2, 2)]]  # Segunda linha tem tuplas curtas
        result = generate_contours(bad_grid, interval=1.0)
        assert result == []

    def test_canonical_elevation_data(self):
        """Teste com dados de elevação sintéticos similares a terreno real BR."""
        # Simula MDT de 4x4 pontos com elevações típicas de Muriaé/MG (~300-400m)
        elevations = [
            [320, 325, 330, 335],
            [325, 330, 340, 345],
            [330, 340, 350, 355],
            [335, 345, 355, 360],
        ]
        grid = [
            [(c * 100.0, r * 100.0, float(elevations[r][c]))
             for c in range(4)]
            for r in range(4)
        ]
        result = generate_contours(grid, interval=5.0)
        assert isinstance(result, list)
        # Com 40m de variação e intervalo de 5m, espera-se curvas
        assert len(result) > 0
