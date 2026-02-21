"""
dxf_drawing.py
Responsabilidade: métodos de desenho de geometrias (polígonos, linhas, pontos)
para o gerador DXF do sisRUA.
"""
import math
try:
    from .dxf_styles import DXFStyleManager
except (ImportError, ValueError):
    from dxf_styles import DXFStyleManager
try:
    from .utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger

from shapely.geometry import LineString, MultiLineString


class DXFDrawingMixin:
    """Mixin com métodos de desenho de geometrias primitivas."""

    def _safe_v(self, v, fallback_val=None):
        """Guarda absoluta para valores float. Retorna fallback_val se inválido."""
        try:
            val = float(v)
            if math.isnan(val) or math.isinf(val) or abs(val) > 1e11:
                return fallback_val if fallback_val is not None else 0.0
            return val
        except (ValueError, TypeError) as e:
            Logger.error(f"Valor float inválido '{v}': {e}")
            return fallback_val if fallback_val is not None else 0.0

    def _safe_p(self, p):
        """Guarda absoluta para tuplas de ponto. Usa centroid como fallback."""
        try:
            cx = self.bounds[0] + (self.bounds[2] - self.bounds[0]) / 2
            cy = self.bounds[1] + (self.bounds[3] - self.bounds[1]) / 2
            return (self._safe_v(p[0], fallback_val=cx), self._safe_v(p[1], fallback_val=cy))
        except (IndexError, TypeError) as e:
            Logger.error(f"Dados de ponto inválidos '{p}': {e}")
            return (0.0, 0.0)

    def _validate_points(self, points, min_points=2, is_3d=False):
        """Valida lista de pontos para entidades DXF."""
        if not points or len(points) < min_points:
            return None
        valid_points = []
        last_p = None
        for p in points:
            try:
                vals = [self._safe_v(v, fallback_val=None) for v in p]
                if None in vals:
                    continue  # pragma: no cover
                curr_p = tuple(vals)
                if curr_p != last_p:
                    valid_points.append(curr_p)
                    last_p = curr_p
            except (ValueError, TypeError, IndexError) as e:
                Logger.error(f"Ponto inválido ignorado na validação: {e}")
                continue
        if len(valid_points) < min_points:
            return None
        return valid_points

    def _get_thickness(self, tags, layer):
        """Calcula altura de extrusão baseada em tags OSM (2.5D)."""
        if layer != 'EDIFICACAO':
            return 0.0
        try:
            if 'height' in tags:
                h = str(tags['height']).split(' ')[0]
                return self._safe_v(float(h), fallback_val=3.5)
            if 'building:levels' in tags:
                return self._safe_v(float(tags['building:levels']) * 3.0, fallback_val=3.5)
            if 'levels' in tags:
                return self._safe_v(float(tags['levels']) * 3.0, fallback_val=3.5)
            return 3.5
        except (ValueError, TypeError, KeyError) as e:
            Logger.error(f"Erro ao calcular altura por tags: {e}")
            return 3.5

    def _draw_polygon(self, poly, layer, diff_x, diff_y, tags):
        """Desenha polígono com hachura e anotação de área para edificações."""
        thickness = self._get_thickness(tags, layer)
        dxf_attribs = {'layer': layer, 'thickness': thickness}

        points = [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in poly.exterior.coords]
        points = self._validate_points(points, min_points=3)
        if not points:
            return
        self.msp.add_lwpolyline(points, close=True, dxfattribs=dxf_attribs)

        if layer == 'EDIFICACAO':
            self._draw_building_annotation(poly, diff_x, diff_y, points)

        for interior in poly.interiors:
            ipts = [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in interior.coords]
            ipts = self._validate_points(ipts, min_points=3)
            if ipts:
                self.msp.add_lwpolyline(ipts, close=True, dxfattribs=dxf_attribs)

    def _draw_building_annotation(self, poly, diff_x, diff_y, points):
        """Anotação de área e hachura ANSI31 para edificações."""
        try:
            area = poly.area
            centroid = poly.centroid
            if centroid and not (math.isnan(area) or math.isinf(area) or
                                 math.isnan(centroid.x) or math.isnan(centroid.y)):
                safe_p = (self._safe_v(centroid.x - diff_x), self._safe_v(centroid.y - diff_y))
                txt = self.msp.add_text(
                    f"{area:.1f} m2",
                    dxfattribs={'layer': 'ANNOT_AREA', 'height': 1.5, 'color': 7}
                )
                txt.dxf.halign = 1
                txt.dxf.valign = 2
                txt.dxf.insert = safe_p
                txt.dxf.align_point = safe_p
        except Exception as e:
            Logger.info(f"Anotação de área falhou: {e}")

        try:
            def deduplicate_epsilon(pts, eps=0.001):
                if not pts:
                    return []
                res = [pts[0]]
                for i in range(1, len(pts)):
                    if math.dist(pts[i], res[-1]) > eps:
                        res.append(pts[i])
                return res

            clean_points = deduplicate_epsilon(points)
            if clean_points and len(clean_points) >= 3:
                hatch = self.msp.add_hatch(color=253, dxfattribs={'layer': 'EDIFICACAO_HATCH'})
                hatch.set_pattern_fill('ANSI31', scale=0.5, angle=45.0)
                hatch.paths.add_polyline_path(clean_points, is_closed=True)
        except Exception as he:
            Logger.info(f"Hachura da edificação falhou: {he}")

    def _draw_linestring(self, line, layer, diff_x, diff_y):
        """Desenha polilinha com anotação de comprimento para vias."""
        pts = [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in line.coords]
        points = self._validate_points(pts, min_points=2)
        if not points:
            return
        self.msp.add_lwpolyline(points, close=False, dxfattribs={'layer': layer})

        if layer == 'VIAS':
            try:
                length = line.length
                if not (math.isnan(length) or math.isinf(length)):
                    mid = line.interpolate(0.5, normalized=True)
                    if mid and not (math.isnan(mid.x) or math.isnan(mid.y)):
                        safe_mid = (self._safe_v(mid.x - diff_x), self._safe_v(mid.y - diff_y))
                        ltxt = self.msp.add_text(
                            f"{length:.1f}m",
                            dxfattribs={'layer': 'ANNOT_LENGTH', 'height': 2.0, 'color': 7, 'rotation': 0.0}
                        )
                        ltxt.dxf.halign = 1
                        ltxt.dxf.valign = 2
                        ltxt.dxf.insert = safe_mid
                        ltxt.dxf.align_point = safe_mid
            except Exception as e:
                Logger.info(f"Anotação de comprimento falhou: {e}")

    def _draw_street_offsets(self, line, tags, diff_x, diff_y):
        """Desenha linhas paralelas (meios-fios) para vias."""
        highway = tags.get('highway', 'residential')
        if highway in ['footway', 'path', 'cycleway', 'steps']:
            return

        width = DXFStyleManager.get_street_width(highway)

        try:
            if hasattr(line, 'offset_curve'):
                left = line.offset_curve(width, join_style=2)
                right = line.offset_curve(-width, join_style=2)
            else:
                left = line.parallel_offset(width, 'left', join_style=2)
                right = line.parallel_offset(width, 'right', join_style=2)

            for side_geom in [left, right]:
                if side_geom.is_empty:
                    continue
                if isinstance(side_geom, LineString):
                    pts = [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in side_geom.coords]
                    pts = self._validate_points(pts, min_points=2)
                    if pts:
                        self.msp.add_lwpolyline(pts, dxfattribs={'layer': 'VIAS_MEIO_FIO', 'color': 251})
                elif isinstance(side_geom, MultiLineString):
                    for subline in side_geom.geoms:
                        pts = [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in subline.coords]
                        pts = self._validate_points(pts, min_points=2)
                        if pts:
                            self.msp.add_lwpolyline(pts, dxfattribs={'layer': 'VIAS_MEIO_FIO', 'color': 251})
        except Exception as e:
            Logger.info(f"Offset de via falhou: {e}")

    def _sanitize_attribs(self, attribs):
        """Remove valores 'nan' dos atributos."""
        sanitized = {}
        for k, v in attribs.items():
            val = str(v)
            sanitized[k] = "N/A" if val.lower() == 'nan' or not val.strip() else val
        return sanitized

    def _draw_point(self, point, layer, diff_x, diff_y, tags):
        """Desenha ponto OSM como círculo ou referência de bloco."""
        if math.isnan(point.x) or math.isnan(point.y):
            return

        x, y = self._safe_v(point.x - diff_x), self._safe_v(point.y - diff_y)
        attribs = self._sanitize_attribs({
            'ID': tags.get('osmid', '999'),
            'TYPE': tags.get('power', tags.get('amenity', 'DESCONHECIDO')),
            'V_LEVEL': tags.get('voltage', '0V')
        })

        if layer == 'VEGETACAO':
            self.msp.add_blockref('ARVORE', (x, y))
        elif layer == 'MOBILIARIO_URBANO':
            amenity = tags.get('amenity')
            highway = tags.get('highway')
            if amenity == 'bench':
                self.msp.add_blockref('BANCO', (x, y))
            elif amenity == 'waste_basket':
                self.msp.add_blockref('LIXEIRA', (x, y))
            elif highway == 'street_lamp':
                self.msp.add_blockref('POSTE_LUZ', (x, y))
            else:
                self.msp.add_circle((x, y), radius=0.3, dxfattribs={'layer': layer, 'color': 40})
        elif layer == 'EQUIPAMENTOS':
            self.msp.add_blockref('POSTE', (x, y)).add_auto_attribs(attribs)
        elif 'INFRA_POWER' in layer:
            if layer == 'INFRA_POWER_HV' or tags.get('power') == 'tower':
                self.msp.add_blockref('TORRE', (x, y)).add_auto_attribs(attribs)
            else:
                self.msp.add_blockref('POSTE', (x, y)).add_auto_attribs(attribs)
        elif layer in ('REDE_AT', 'REDE_MT', 'REDE_BT', 'SUBESTACAO', 'TRANSFORMADOR'):
            if layer == 'REDE_AT' or tags.get('power') == 'tower':
                self.msp.add_blockref('TORRE', (x, y)).add_auto_attribs(attribs)
            elif layer == 'TRANSFORMADOR':
                self.msp.add_circle((x, y), radius=0.8, dxfattribs={'layer': layer, 'color': 3})
            else:
                self.msp.add_blockref('POSTE', (x, y)).add_auto_attribs(attribs)
        elif layer == 'INFRA_TELECOM':
            self.msp.add_blockref('POSTE', (x, y), dxfattribs={'xscale': 0.8, 'yscale': 0.8}).add_auto_attribs(attribs)
        else:
            self.msp.add_circle((x, y), radius=0.5, dxfattribs={'layer': layer})
