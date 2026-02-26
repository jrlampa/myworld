import pytest
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from infrastructure.dxf_abnt import ABNTTitleBlock

def test_nbr_16752_dimensions():
    assert ABNTTitleBlock.BLOCK_WIDTH == 170.0, "Largura da legenda deve ser exatamente 170mm (NBR 16752:2020)"
    assert ABNTTitleBlock.LEFT_MARGIN == 20.0, "Margem esquerda deve ser 20mm"
    assert ABNTTitleBlock.DEFAULT_MARGIN == 10.0, "Margens (direita, superior, inferior) devem ser 10mm"

def test_abnt_titleblock_columns():
    # As colunas internas devem somar 170 e estar distribuídas de acordo
    assert ABNTTitleBlock.COL_LEFT + ABNTTitleBlock.COL_MID + 50.0 == 170.0
