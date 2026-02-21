"""
dxf_generator.py
Responsabilidade: classe principal DXFGenerator - orquestração da geração DXF.
Lógica de desenho: dxf_drawing.py
Elementos cartográficos: dxf_cartography.py
Estilos CAD: dxf_styles.py
"""
import ezdxf
import os
import numpy as np
import pandas as pd
from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString, Point
import geopandas as gpd
import math
try:
    from .dxf_styles import DXFStyleManager
except (ImportError, ValueError):
    from dxf_styles import DXFStyleManager
try:
    from .dxf_drawing import DXFDrawingMixin
except (ImportError, ValueError):
    from dxf_drawing import DXFDrawingMixin
try:
    from .dxf_cartography import DXFCartographyMixin
except (ImportError, ValueError):
    from dxf_cartography import DXFCartographyMixin
try:
    from .utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger


class DXFGenerator(DXFDrawingMixin, DXFCartographyMixin):
    """
    Gerador de arquivos DXF 2.5D a partir de dados OSM.

    Usa mixins para separação de responsabilidades:
    - DXFDrawingMixin: métodos de desenho (polígonos, linhas, pontos)
    - DXFCartographyMixin: legenda, carimbo, grade de coordenadas
    """

    def __init__(self, filename):
        self.filename = filename
        self.doc = ezdxf.new('R2013')
        self.diff_x = 0.0
        self.diff_y = 0.0
        self.bounds = [0.0, 0.0, 0.0, 0.0]
        DXFStyleManager.setup_all(self.doc)
        self.msp = self.doc.modelspace()
        self.project_info = {}
        self._offset_initialized = False
        self.aneel_prodist = False

    def add_features(self, gdf):
        """
        Itera sobre GeoDataFrame e adiciona entidades ao DXF.
        Assume o GDF projetado (unidades em metros).
        """
        if gdf.empty:
            return

        # OFFSET AUTORITATIVO: definido uma vez, aplicado em tudo
        if not self._offset_initialized:
            centroids = gdf.geometry.centroid
            cx = centroids.x.dropna().mean() if not centroids.x.dropna().empty else 0.0
            cy = centroids.y.dropna().mean() if not centroids.y.dropna().empty else 0.0
            self.diff_x = self._safe_v(cx)
            self.diff_y = self._safe_v(cy)
            self._offset_initialized = True

        b = gdf.total_bounds
        if any(math.isnan(v) or math.isinf(v) for v in b):
            self.bounds = [0.0, 0.0, 100.0, 100.0]
        else:
            self.bounds = [float(v) for v in b]

        for _, row in gdf.iterrows():
            geom = row.geometry
            tags = row.drop('geometry')
            layer = self.determine_layer(tags, row)
            self._draw_geometry(geom, layer, self.diff_x, self.diff_y, tags)

    def determine_layer(self, tags, row):
        """Mapeia tags OSM para Camadas DXF."""
        if 'power' in tags and not pd.isna(tags['power']):
            if self.aneel_prodist:
                try:
                    from dxf_aneel import get_aneel_layer
                except (ImportError, ValueError):
                    from .dxf_aneel import get_aneel_layer
                return get_aneel_layer(dict(tags))
            if tags['power'] in ['line', 'tower', 'substation']:
                return 'INFRA_POWER_HV'
            return 'INFRA_POWER_LV'

        if 'telecom' in tags and not pd.isna(tags['telecom']):
            return 'INFRA_TELECOM'

        furniture_amenities = ['bench', 'waste_basket', 'bicycle_parking', 'fountain', 'drinking_water']
        if ('amenity' in tags and tags['amenity'] in furniture_amenities) or \
           ('highway' in tags and tags['highway'] == 'street_lamp'):
            return 'MOBILIARIO_URBANO'

        if 'building' in tags and not pd.isna(tags['building']):
            return 'EDIFICACAO'
        if 'highway' in tags and not pd.isna(tags['highway']):
            return 'VIAS'
        if 'natural' in tags and tags['natural'] in ['tree', 'wood', 'scrub']:
            return 'VEGETACAO'
        if 'amenity' in tags:
            return 'EQUIPAMENTOS'
        if 'leisure' in tags:
            return 'VEGETACAO'
        if 'waterway' in tags or ('natural' in tags and tags['natural'] == 'water'):
            return 'HIDROGRAFIA'

        return '0'

    def _simplify_line(self, line, tolerance=0.1):
        """Simplificação via shapely para resultados robustos."""
        return line.simplify(tolerance, preserve_topology=True)

    def _merge_contiguous_lines(self, lines_with_tags):
        """
        Tenta unir LineStrings que compartilham endpoints com tags idênticas.
        Usa threshold de distância para lidar com ruído de coordenadas.
        """
        if not lines_with_tags:
            return []

        merged_results = []
        processed = set()
        dist_threshold = 0.5

        def get_dist(pa, pb):
            return math.sqrt((pa[0] - pb[0]) ** 2 + (pa[1] - pb[1]) ** 2)

        for i, (line, tags) in enumerate(lines_with_tags):
            if i in processed:
                continue
            curr_line = line
            processed.add(i)
            changed = True
            while changed:
                changed = False
                for j, (other_line, other_tags) in enumerate(lines_with_tags):
                    if j in processed:
                        continue
                    if tags.get('name') != other_tags.get('name') or \
                       tags.get('highway') != other_tags.get('highway'):
                        continue
                    p1_start, p1_end = curr_line.coords[0], curr_line.coords[-1]
                    p2_start, p2_end = other_line.coords[0], other_line.coords[-1]
                    new_coords = None
                    if get_dist(p1_end, p2_start) < dist_threshold:
                        new_coords = list(curr_line.coords) + list(other_line.coords)[1:]
                    elif get_dist(p1_start, p2_end) < dist_threshold:
                        new_coords = list(other_line.coords) + list(curr_line.coords)[1:]
                    elif get_dist(p1_start, p2_start) < dist_threshold:
                        new_coords = list(reversed(other_line.coords)) + list(curr_line.coords)[1:]
                    elif get_dist(p1_end, p2_end) < dist_threshold:
                        new_coords = list(curr_line.coords) + list(reversed(other_line.coords))[1:]
                    if new_coords:
                        curr_line = LineString(new_coords)
                        processed.add(j)
                        changed = True
                        break
            merged_results.append((curr_line, tags))

        Logger.info(f"Fusão de geometrias: {len(lines_with_tags)} segmentos → {len(merged_results)} polilinhas.")
        return merged_results

    def _draw_geometry(self, geom, layer, diff_x, diff_y, tags):
        """Desenho recursivo de geometrias com suporte a textos."""
        if geom.is_empty:
            return

        if layer not in self.doc.layers:
            layer = '0'

        # Rótulos de ruas
        if (layer == 'VIAS' or layer == '0') and 'name' in tags:
            name = str(tags['name'])
            if name.lower() != 'nan' and name.strip():
                self._draw_street_label(geom, name, diff_x, diff_y)

        if isinstance(geom, Polygon):
            self._draw_polygon(geom, layer, diff_x, diff_y, tags)
        elif isinstance(geom, MultiPolygon):
            for poly in geom.geoms:
                self._draw_polygon(poly, layer, diff_x, diff_y, tags)
        if isinstance(geom, LineString):
            self._draw_linestring(geom, layer, diff_x, diff_y)
            if layer == 'VIAS' and 'highway' in tags:
                self._draw_street_offsets(geom, tags, diff_x, diff_y)
        elif isinstance(geom, MultiLineString):
            for line in geom.geoms:
                self._draw_linestring(line, layer, diff_x, diff_y)
                if layer == 'VIAS' and 'highway' in tags:
                    self._draw_street_offsets(line, tags, diff_x, diff_y)
        elif isinstance(geom, Point):
            self._draw_point(geom, layer, diff_x, diff_y, tags)

    def _draw_street_label(self, geom, name, diff_x, diff_y):
        """Desenha rótulo de via posicionado ao longo da geometria."""
        rotation = 0.0
        centroid = geom.centroid
        if not centroid.is_empty and not math.isnan(centroid.x) and not math.isnan(centroid.y):
            if isinstance(geom, LineString) and geom.length > 0.1:
                try:
                    p1 = geom.interpolate(0.45, normalized=True)
                    p2 = geom.interpolate(0.55, normalized=True)
                    if p1 and p2:
                        dx = p2.x - p1.x
                        dy = p2.y - p1.y
                        if abs(dx) > 1e-5 or abs(dy) > 1e-5:
                            angle = np.degrees(np.arctan2(dy, dx))
                            rotation = angle if -90 <= angle <= 90 else angle + 180
                except Exception:
                    pass

            try:
                safe_val = self._safe_v(rotation)
                safe_align = (self._safe_v(centroid.x - diff_x), self._safe_v(centroid.y - diff_y))
                text = self.msp.add_text(
                    name,
                    dxfattribs={'layer': 'TEXTO', 'height': 2.5, 'rotation': safe_val, 'style': 'PRO_STYLE'}
                )
                text.dxf.halign = 1
                text.dxf.valign = 2
                text.dxf.insert = safe_align
                text.dxf.align_point = safe_align
            except Exception as te:
                Logger.info(f"Criação de rótulo falhou: {te}")

    def add_terrain_from_grid(self, grid_rows):
        """
        Adiciona malha de terreno 2.5D ao DXF.
        grid_rows: Lista de linhas, cada linha com tuplas (x, y, z).
        """
        if not grid_rows or not grid_rows[0]:
            return

        rows = len(grid_rows)
        cols = len(grid_rows[0])

        if rows < 2 or cols < 2:
            return

        mesh = self.msp.add_polymesh(size=(rows, cols), dxfattribs={'layer': 'TERRENO', 'color': 252})

        for r, row in enumerate(grid_rows):
            for c, p in enumerate(row):
                try:
                    x = self._safe_v(float(p[0]) - self.diff_x)
                    y = self._safe_v(float(p[1]) - self.diff_y)
                    z = self._safe_v(float(p[2]))
                    mesh.set_mesh_vertex((r, c), (x, y, z))
                except (ValueError, TypeError, IndexError) as e:
                    Logger.error(f"Erro ao definir vértice da malha em ({r}, {c}): {e}")
                    mesh.set_mesh_vertex((r, c), (0.0, 0.0, 0.0))

    def add_contour_lines(self, contour_lines):
        """
        Desenha curvas de nível 2.5D.
        contour_lines: Lista de pontos [(x, y, z), ...].
        """
        for line_points in contour_lines:
            if len(line_points) < 2:
                continue
            valid_line = self._validate_points(line_points, min_points=2, is_3d=True)
            if valid_line:
                self.msp.add_polyline3d(
                    valid_line,
                    dxfattribs={'layer': 'TOPOGRAFIA_CURVAS', 'color': 8}
                )

    def save(self):
        """Finalização profissional e salvamento do DXF."""
        try:
            self.add_legend()
            # Estimativa da extensão real do modelo para cálculo de escala ABNT NBR 8196
            drawing_extent = max(
                abs(self.bounds[2] - self.bounds[0]),
                abs(self.bounds[3] - self.bounds[1]),
                1.0,
            )
            self.add_title_block(
                client=self.project_info.get('client', 'CLIENTE PADRÃO'),
                project=self.project_info.get('project', 'EXTRAÇÃO ESPACIAL OSM'),
                designer=self.project_info.get('designer', 'sisRUA AI'),
                numero_desenho=self.project_info.get('numero_desenho', 'SR-0001'),
                verificado_por=self.project_info.get('verificado_por', ''),
                aprovado_por=self.project_info.get('aprovado_por', ''),
                revisao=self.project_info.get('revisao', 'A'),
                drawing_extent_m=drawing_extent,
            )
            output_dir = os.path.dirname(self.filename)
            if output_dir and output_dir != '.':
                os.makedirs(output_dir, exist_ok=True)
            self.doc.saveas(self.filename)
            Logger.info(f"DXF salvo com sucesso: {os.path.basename(self.filename)}")
        except Exception as e:
            Logger.error(f"Erro ao salvar DXF: {e}")
            raise
