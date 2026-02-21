"""
test_dxf_aneel.py
Testes unitários para o módulo dxf_aneel.py (ANEEL/PRODIST).
Canonical coords: lat=-22.15018, lon=-42.92185 (Muriaé/MG, Zona UTM 23K)
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import ezdxf
from dxf_aneel import (
    classify_voltage,
    get_aneel_layer,
    get_aneel_buffer,
    setup_aneel_layers,
    LAYER_AT, LAYER_MT, LAYER_BT, LAYER_SE, LAYER_TRANSF,
    BUFFER_AT_M, BUFFER_MT_M, BUFFER_BT_M,
    TENSAO_AT_MIN_V, TENSAO_MT_MIN_V,
    ANEEL_LAYER_DEFS,
)


class TestConstants:
    def test_tensao_at_threshold(self):
        assert TENSAO_AT_MIN_V == 36_200

    def test_tensao_mt_threshold(self):
        assert TENSAO_MT_MIN_V == 1_000

    def test_layer_names(self):
        assert LAYER_AT == 'REDE_AT'
        assert LAYER_MT == 'REDE_MT'
        assert LAYER_BT == 'REDE_BT'
        assert LAYER_SE == 'SUBESTACAO'
        assert LAYER_TRANSF == 'TRANSFORMADOR'

    def test_buffer_distances(self):
        assert BUFFER_AT_M == 15.0
        assert BUFFER_MT_M == 8.0
        assert BUFFER_BT_M == 3.0

    def test_aneel_layer_defs_count(self):
        assert len(ANEEL_LAYER_DEFS) == 5


class TestClassifyVoltage:
    def test_at_high_voltage(self):
        assert classify_voltage('138000') == 'AT'   # 138 kV — transmissão

    def test_at_exact_threshold(self):
        assert classify_voltage('36200') == 'AT'    # exatamente AT_MIN

    def test_mt_distribution(self):
        assert classify_voltage('13800') == 'MT'    # 13,8 kV — distribuição MT

    def test_mt_exact_lower_threshold(self):
        assert classify_voltage('1000') == 'MT'     # exatamente MT_MIN

    def test_bt_low_voltage_220(self):
        assert classify_voltage('220') == 'BT'      # 220 V — BT residencial

    def test_bt_low_voltage_127(self):
        assert classify_voltage('127') == 'BT'      # 127 V — BT residencial

    def test_empty_string_defaults_mt(self):
        assert classify_voltage('') == 'MT'

    def test_none_like_empty_defaults_mt(self):
        assert classify_voltage(None) == 'MT'       # None → str(None) → 'None' → falls to except

    def test_whitespace_defaults_mt(self):
        assert classify_voltage('   ') == 'MT'

    def test_semicolon_multiple_takes_max(self):
        # '138000;13800' → max=138000 → AT
        assert classify_voltage('138000;13800') == 'AT'

    def test_semicolon_all_mt(self):
        # '13800;11000' → max=13800 → MT
        assert classify_voltage('13800;11000') == 'MT'

    def test_invalid_string_defaults_mt(self):
        assert classify_voltage('indeterminado') == 'MT'

    def test_zero_voltage_bt(self):
        assert classify_voltage('0') == 'BT'

    def test_below_at_above_mt(self):
        assert classify_voltage('30000') == 'MT'    # 30 kV < 36,2 kV → MT


class TestGetAneelLayer:
    def test_substation(self):
        assert get_aneel_layer({'power': 'substation'}) == LAYER_SE

    def test_transformer(self):
        assert get_aneel_layer({'power': 'transformer'}) == LAYER_TRANSF

    def test_minor_line_always_bt(self):
        assert get_aneel_layer({'power': 'minor_line'}) == LAYER_BT

    def test_cable_always_bt(self):
        assert get_aneel_layer({'power': 'cable'}) == LAYER_BT

    def test_line_at_by_voltage(self):
        assert get_aneel_layer({'power': 'line', 'voltage': '138000'}) == LAYER_AT

    def test_line_mt_by_voltage(self):
        assert get_aneel_layer({'power': 'line', 'voltage': '13800'}) == LAYER_MT

    def test_line_bt_by_voltage(self):
        assert get_aneel_layer({'power': 'line', 'voltage': '220'}) == LAYER_BT

    def test_tower_at_by_voltage(self):
        assert get_aneel_layer({'power': 'tower', 'voltage': '500000'}) == LAYER_AT

    def test_pole_no_voltage_defaults_mt(self):
        # 'pole' with no voltage → classify_voltage('') → 'MT'
        assert get_aneel_layer({'power': 'pole'}) == LAYER_MT

    def test_non_string_voltage_handled(self):
        # Some OSM parsers may return numeric voltage
        assert get_aneel_layer({'power': 'line', 'voltage': 138000}) == LAYER_AT

    def test_non_string_power_handled(self):
        # Defensive: power tag as non-string
        result = get_aneel_layer({'power': None})
        assert result in (LAYER_AT, LAYER_MT, LAYER_BT, LAYER_SE, LAYER_TRANSF)


class TestGetAneelBuffer:
    def test_at_buffer(self):
        assert get_aneel_buffer(LAYER_AT) == BUFFER_AT_M

    def test_mt_buffer(self):
        assert get_aneel_buffer(LAYER_MT) == BUFFER_MT_M

    def test_bt_buffer(self):
        assert get_aneel_buffer(LAYER_BT) == BUFFER_BT_M

    def test_se_defaults_to_bt_buffer(self):
        # Subestação não é linha → não tem faixa AT/MT, usa fallback BT
        assert get_aneel_buffer(LAYER_SE) == BUFFER_BT_M

    def test_unknown_layer_defaults_to_bt_buffer(self):
        assert get_aneel_buffer('UNKNOWN') == BUFFER_BT_M


class TestSetupAneelLayers:
    def _new_doc(self):
        return ezdxf.new('R2013')

    def test_creates_all_five_layers(self):
        doc = self._new_doc()
        setup_aneel_layers(doc)
        for name, *_ in ANEEL_LAYER_DEFS:
            assert name in doc.layers, f"Layer '{name}' não foi criado"

    def test_at_layer_color_red(self):
        doc = self._new_doc()
        setup_aneel_layers(doc)
        assert doc.layers.get(LAYER_AT).dxf.color == 1  # 1 = vermelho AutoCAD

    def test_mt_layer_color_cyan(self):
        doc = self._new_doc()
        setup_aneel_layers(doc)
        assert doc.layers.get(LAYER_MT).dxf.color == 4  # 4 = ciano AutoCAD

    def test_bt_layer_color_yellow(self):
        doc = self._new_doc()
        setup_aneel_layers(doc)
        assert doc.layers.get(LAYER_BT).dxf.color == 2  # 2 = amarelo AutoCAD

    def test_idempotent_no_duplicate_on_second_call(self):
        doc = self._new_doc()
        setup_aneel_layers(doc)
        setup_aneel_layers(doc)  # Segunda chamada não deve duplicar ou lançar exceção
        # Count layers: only one of each should exist
        layer_names = [layer.dxf.name for layer in doc.layers]
        for name, *_ in ANEEL_LAYER_DEFS:
            assert layer_names.count(name) == 1

    def test_headless_audit_zero_errors(self):
        """Audit DXF headless (equivalente a accoreconsole.exe) — deve ter 0 erros."""
        doc = self._new_doc()
        setup_aneel_layers(doc)
        audit = doc.audit()
        assert len(audit.errors) == 0


class TestAneelIntegration:
    def test_dxf_generator_with_aneel_prodist_uses_aneel_layers(self):
        """DXFGenerator com aneel_prodist=True deve usar layers ANEEL para power tags."""
        from dxf_generator import DXFGenerator
        from dxf_aneel import setup_aneel_layers
        import pandas as pd

        gen = DXFGenerator('/tmp/test_aneel_integration.dxf')
        gen.aneel_prodist = True
        setup_aneel_layers(gen.doc)

        tags_at = pd.Series({'power': 'line', 'voltage': '138000', 'name': 'LT 138kV'})
        layer = gen.determine_layer(tags_at, tags_at)
        assert layer == LAYER_AT, f"Esperado REDE_AT, obtido {layer}"

    def test_dxf_generator_without_aneel_uses_legacy_layers(self):
        """DXFGenerator sem aneel_prodist deve usar layers legados (INFRA_POWER_HV)."""
        from dxf_generator import DXFGenerator
        import pandas as pd

        gen = DXFGenerator('/tmp/test_legacy_power.dxf')
        assert gen.aneel_prodist is False  # padrão

        tags_hv = pd.Series({'power': 'line', 'voltage': '138000'})
        layer = gen.determine_layer(tags_hv, tags_hv)
        assert layer == 'INFRA_POWER_HV'

    def test_aneel_layer_at_in_dxf_document(self):
        """Após setup_aneel_layers, o documento DXF deve conter REDE_AT com cor vermelha."""
        from dxf_generator import DXFGenerator
        from dxf_aneel import setup_aneel_layers

        gen = DXFGenerator('/tmp/test_aneel_doc.dxf')
        setup_aneel_layers(gen.doc)
        assert LAYER_AT in gen.doc.layers
        assert gen.doc.layers.get(LAYER_AT).dxf.color == 1  # vermelho
