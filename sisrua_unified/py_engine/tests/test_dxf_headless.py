"""
test_dxf_headless.py
Testes headless específicos para validação de arquivos DXF gerados.

Substitui accoreconsole.exe em ambientes Linux/CI usando ezdxf.audit().
Executar: python -m pytest tests/test_dxf_headless.py -v

Coordenadas canônicas de teste (Muriaé/MG):
  UTM 23K: E=788547, N=7634925 → raio 100m
  WGS84: lat=-22.15018, lon=-42.92185 → raios 500m e 1km
"""
import os
import sys
import pytest
import ezdxf
from shapely.geometry import Point, LineString, Polygon
import geopandas as gpd

# Garante imports locais ou relativos
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dxf_generator import DXFGenerator
from constants import (
    TEST_LAT, TEST_LON, TEST_UTM_E, TEST_UTM_N, TEST_RADII,
    LAYER_EDIFICACAO, LAYER_VEGETACAO, LAYER_VIAS_RESIDENTIAL,
    LAYER_TEXTO, LAYER_QUADRO, DXF_VERSION,
)


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def dxf_path(tmp_path):
    """Retorna caminho para arquivo DXF temporário."""
    return str(tmp_path / "headless_test.dxf")


@pytest.fixture
def gen(dxf_path):
    """DXFGenerator pronto com coordenadas canônicas de teste."""
    g = DXFGenerator(dxf_path)
    g.project_info = {
        "client": "TESTE HEADLESS CI",
        "project": f"VALIDACAO DXF — LAT={TEST_LAT} LON={TEST_LON}",
    }
    return g


@pytest.fixture
def populated_gen(gen):
    """DXFGenerator com features sintéticas representativas das coordenadas canônicas."""
    base_e, base_n = float(TEST_UTM_E), float(TEST_UTM_N)

    data = {
        "geometry": [
            # Edificação
            Polygon([
                (base_e, base_n), (base_e + 20, base_n),
                (base_e + 20, base_n + 20), (base_e, base_n + 20),
            ]),
            # Via residencial
            LineString([(base_e, base_n), (base_e + 80, base_n + 40)]),
            # Via primária
            LineString([(base_e - 30, base_n + 10), (base_e + 100, base_n + 10)]),
            # Árvore
            Point(base_e + 10, base_n + 50),
            # Segunda edificação
            Polygon([
                (base_e + 30, base_n + 30), (base_e + 50, base_n + 30),
                (base_e + 50, base_n + 50), (base_e + 30, base_n + 50),
            ]),
        ],
        "building": ["yes", None, None, None, "residential"],
        "height": ["9", None, None, None, None],
        "building:levels": [None, None, None, None, "3"],
        "highway": [None, "residential", "primary", None, None],
        "natural": [None, None, None, "tree", None],
        "name": [None, "Rua de Teste", "Avenida Principal", None, None],
    }

    gdf = gpd.GeoDataFrame(data)
    gen.add_features(gdf)
    gen.save()
    return gen


# ─── Testes de Integridade Estrutural ────────────────────────────────────────

class TestDxfHeadlessIntegrity:
    """Valida a integridade estrutural do DXF gerado (substitui accoreconsole)."""

    def test_file_is_created(self, populated_gen, dxf_path):
        """O arquivo DXF deve existir no disco."""
        assert os.path.exists(dxf_path), "Arquivo DXF não foi criado"

    def test_file_is_not_empty(self, populated_gen, dxf_path):
        """O arquivo DXF não deve ser vazio."""
        assert os.path.getsize(dxf_path) > 0, "Arquivo DXF está vazio"

    def test_dxf_is_readable(self, populated_gen, dxf_path):
        """O arquivo DXF deve ser lido sem exceção (validação headless primária)."""
        doc = ezdxf.readfile(dxf_path)
        assert doc is not None

    def test_dxf_audit_no_errors(self, populated_gen, dxf_path):
        """ezdxf.audit() não deve reportar erros estruturais no DXF gerado."""
        doc = ezdxf.readfile(dxf_path)
        auditor = doc.audit()
        error_msgs = [f"[{e.code}] {e.message}" for e in auditor.errors]
        assert not auditor.has_errors, (
            f"DXF contém {len(auditor.errors)} erro(s) estrutural(is):\n"
            + "\n".join(error_msgs)
        )

    def test_dxf_version(self, populated_gen, dxf_path):
        """O DXF deve ser gerado na versão esperada (R2013/AC1027)."""
        doc = ezdxf.readfile(dxf_path)
        assert doc.dxfversion == "AC1027", (
            f"Versão esperada AC1027 (R2013), encontrada: {doc.dxfversion}"
        )


# ─── Testes de Layers ─────────────────────────────────────────────────────────

class TestDxfLayers:
    """Verifica que os layers sisRUA_* estão presentes e nomeados corretamente."""

    REQUIRED_LAYERS = [
        LAYER_EDIFICACAO,
        LAYER_VEGETACAO,
        "VIAS",
        LAYER_TEXTO,
        LAYER_QUADRO,
    ]

    def test_required_layers_exist(self, populated_gen, dxf_path):
        """Layers obrigatórios devem estar presentes no DXF."""
        doc = ezdxf.readfile(dxf_path)
        layer_names = [layer.dxf.name for layer in doc.layers]
        for required in self.REQUIRED_LAYERS:
            assert required in layer_names, (
                f"Layer obrigatório ausente: '{required}'. "
                f"Layers presentes: {layer_names}"
            )

    def test_all_content_layers_are_known(self, populated_gen, dxf_path):
        """Layers de conteúdo devem ser os definidos em dxf_styles.py (sem layers estranhos)."""
        doc = ezdxf.readfile(dxf_path)
        known_layers = {
            "0", "Defpoints",
            "EDIFICACAO", "EDIFICACAO_HATCH",
            "VIAS", "VIAS_MEIO_FIO",
            "VEGETACAO", "MOBILIARIO_URBANO", "EQUIPAMENTOS",
            "HIDROGRAFIA",
            "INFRA_POWER_HV", "INFRA_POWER_LV", "INFRA_TELECOM",
            "TOPOGRAFIA_CURVAS", "TERRENO",
            "MALHA_COORD", "ANNOT_AREA", "ANNOT_LENGTH",
            "LEGENDA", "TEXTO",
            "CURVAS_NIVEL_MESTRA", "CURVAS_NIVEL_INTERM",
            "QUADRO",
        }
        actual_layers = {layer.dxf.name for layer in doc.layers}
        unknown = actual_layers - known_layers
        assert not unknown, (
            f"Layers não reconhecidos no DXF (verificar dxf_styles.py): {unknown}"
        )


# ─── Testes de Entidades ─────────────────────────────────────────────────────

class TestDxfEntities:
    """Verifica que as entidades foram criadas no model space."""

    def test_modelspace_has_entities(self, populated_gen, dxf_path):
        """O Model Space deve conter entidades após adição de features."""
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
        assert len(msp) > 0, "Model Space está vazio — nenhuma entidade criada"

    def test_buildings_use_hatch_or_solid(self, populated_gen, dxf_path):
        """Edificações devem ser representadas por HATCH, SOLID ou LWPOLYLINE."""
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
        building_types = {"HATCH", "SOLID", "LWPOLYLINE", "POLYLINE", "3DFACE"}
        building_layers = {LAYER_EDIFICACAO, "EDIFICACAO_HATCH"}
        building_entities = [
            e for e in msp
            if e.dxftype() in building_types
            and e.dxf.hasattr("layer")
            and e.dxf.layer in building_layers
        ]
        assert len(building_entities) > 0, (
            f"Nenhuma entidade de edificação encontrada nos layers {building_layers}"
        )

    def test_legend_text_exists(self, populated_gen, dxf_path):
        """A legenda deve conter texto 'LEGENDA'."""
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
        all_text = []
        for e in msp:
            if e.dxftype() == "TEXT":
                all_text.append(e.dxf.text)
            elif e.dxftype() == "MTEXT":
                all_text.append(e.text)
        assert any("LEGENDA" in t for t in all_text), (
            "Texto 'LEGENDA' não encontrado no Model Space"
        )

    def test_title_block_in_paperspace(self, populated_gen, dxf_path):
        """O carimbo deve existir no Paper Space (Layout1)."""
        doc = ezdxf.readfile(dxf_path)
        layout_names = [l.name for l in doc.layouts]
        assert "Layout1" in layout_names, "Layout1 (Paper Space) não encontrado"
        layout = doc.layout("Layout1")
        layout_text = []
        for e in layout:
            if e.dxftype() == "TEXT":
                layout_text.append(e.dxf.text)
            elif e.dxftype() == "MTEXT":
                layout_text.append(e.text)
        assert any("TESTE HEADLESS CI" in t for t in layout_text), (
            "Nome do cliente não encontrado no carimbo (Paper Space)"
        )

    def test_viewport_in_paperspace(self, populated_gen, dxf_path):
        """O Paper Space deve ter pelo menos um Viewport."""
        doc = ezdxf.readfile(dxf_path)
        layout = doc.layout("Layout1")
        viewports = [e for e in layout if e.dxftype() == "VIEWPORT"]
        assert len(viewports) >= 1, "Nenhum VIEWPORT encontrado no Paper Space"


# ─── Testes de Coordenadas e Projeção ────────────────────────────────────────

class TestDxfCoordinates:
    """Verifica que o offset de coordenadas é aplicado corretamente."""

    def test_offset_applied_for_canonical_coords(self, gen):
        """O offset deve ser inicializado após add_features() com coords canônicas."""
        base_e, base_n = float(TEST_UTM_E), float(TEST_UTM_N)
        data = {
            "geometry": [Point(base_e, base_n)],
            "natural": ["tree"],
            "highway": [None],
            "building": [None],
        }
        gdf = gpd.GeoDataFrame(data)
        gen.add_features(gdf)

        assert gen._offset_initialized, "Offset deve ser inicializado após add_features()"
        assert abs(gen.diff_x - base_e) < 1.0, f"diff_x incorreto: {gen.diff_x}"
        assert abs(gen.diff_y - base_n) < 1.0, f"diff_y incorreto: {gen.diff_y}"

    def test_dxf_entities_within_reasonable_bounds(self, populated_gen, dxf_path):
        """Entidades no DXF devem ter coordenadas dentro de limites razoáveis (offset aplicado)."""
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
        max_coord = 1e6  # Depois de offset, coordenadas devem ser < 1 milhão
        for entity in msp:
            if entity.dxftype() == "LWPOLYLINE" and entity.dxf.hasattr("layer"):
                for point in entity.get_points():
                    x, y = point[0], point[1]
                    assert abs(x) < max_coord, f"Coordenada X fora dos limites: {x}"
                    assert abs(y) < max_coord, f"Coordenada Y fora dos limites: {y}"


# ─── Testes de Radii Canônicos ────────────────────────────────────────────────

class TestDxfCanonicalRadii:
    """Gera DXF para cada raio canônico de teste e valida."""

    @pytest.mark.parametrize("radius", TEST_RADII)
    def test_generates_valid_dxf_for_each_radius(self, tmp_path, radius):
        """Deve gerar DXF válido para cada raio canônico (100m, 500m, 1km)."""
        base_e, base_n = float(TEST_UTM_E), float(TEST_UTM_N)
        out = str(tmp_path / f"test_r{radius}m.dxf")
        g = DXFGenerator(out)
        g.project_info = {
            "client": "CI AUTOMATIZADO",
            "project": f"RAIO {radius}m — UTM23K",
        }

        # Simula features proporcionais ao raio
        r = float(radius)
        data = {
            "geometry": [
                LineString([(base_e, base_n), (base_e + r, base_n + r * 0.5)]),
                Point(base_e + r * 0.2, base_n + r * 0.3),
            ],
            "highway": ["residential", None],
            "natural": [None, "tree"],
            "building": [None, None],
        }
        gdf = gpd.GeoDataFrame(data)
        g.add_features(gdf)
        g.save()

        # Validação headless
        assert os.path.exists(out), f"DXF não criado para raio {radius}m"
        assert os.path.getsize(out) > 0, f"DXF vazio para raio {radius}m"
        doc = ezdxf.readfile(out)
        auditor = doc.audit()
        assert not auditor.has_errors, (
            f"DXF para raio {radius}m contém erros: "
            + str([e.message for e in auditor.errors])
        )
