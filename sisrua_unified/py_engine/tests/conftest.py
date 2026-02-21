"""
conftest.py — Fixtures compartilhadas para toda a suíte de testes Python.

Fixtures disponíveis para todos os arquivos de teste neste diretório:
  gen            — DXFGenerator com offset zerado (0,0)
  gen_canonical  — DXFGenerator com coordenadas canônicas Muriaé/MG
"""
import os
import sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dxf_generator import DXFGenerator
from constants import TEST_UTM_E, TEST_UTM_N


@pytest.fixture
def gen(tmp_path):
    """DXFGenerator pronto com offset zerado."""
    g = DXFGenerator(str(tmp_path / "test_drawing.dxf"))
    g.diff_x = 0.0
    g.diff_y = 0.0
    g.bounds = [0.0, 0.0, 100.0, 100.0]
    g._offset_initialized = True
    return g


@pytest.fixture
def gen_canonical(tmp_path):
    """DXFGenerator com coordenadas canônicas de teste aplicadas como offset."""
    g = DXFGenerator(str(tmp_path / "test_canonical.dxf"))
    g.diff_x = float(TEST_UTM_E)
    g.diff_y = float(TEST_UTM_N)
    g.bounds = [float(TEST_UTM_E) - 100, float(TEST_UTM_N) - 100,
                float(TEST_UTM_E) + 100, float(TEST_UTM_N) + 100]
    g._offset_initialized = True
    return g
