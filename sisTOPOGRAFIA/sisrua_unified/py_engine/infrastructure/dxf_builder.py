import ezdxf
import os
import numpy as np
import pandas as pd
from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString, Point
import geopandas as gpd
import math
from ezdxf.enums import TextEntityAlignment

try:
    from .dxf_styles import DXFStyleManager
    from .dxf_cartography import DXFCartographyMixin
    from .bim_data_embedder import BIMDataEmbedder
    from constants import *
except (ImportError, ValueError):
    from dxf_styles import DXFStyleManager
    from infrastructure.dxf_cartography import DXFCartographyMixin
    from infrastructure.bim_data_embedder import BIMDataEmbedder
    from constants import *

try:
    from .utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger

class DXFGenerator(DXFCartographyMixin):
    def __init__(self, filename):
        self.filename = filename
        self.doc = ezdxf.new('R2013')
        self.diff_x = 0.0
        self.diff_y = 0.0
        self.bounds = [0.0, 0.0, 0.0, 0.0]  
        
        DXFStyleManager.setup_all(self.doc)
        BIMDataEmbedder.setup(self.doc)
        
        self.msp = self.doc.modelspace()
        self.project_info = {} 
        self._offset_initialized = False

    def add_features(self, gdf):
        if gdf.empty: return

        if not self._offset_initialized:
            centroids = gdf.geometry.centroid
            cx = centroids.x.dropna().mean() if not centroids.x.dropna().empty else 0.0
            cy = centroids.y.dropna().mean() if not centroids.y.dropna().empty else 0.0
            self.diff_x = self._safe_v(cx)
            self.diff_y = self._safe_v(cy)
            self._offset_initialized = True

        b = gdf.total_bounds
        if not any(math.isnan(v) or math.isinf(v) for v in b):
             self.bounds = [float(v) for v in b]

        for _, row in gdf.iterrows():
            geom = row.geometry
            tags = row.drop('geometry')
            layer = self.determine_layer(tags, row)
            self._draw_geometry(geom, layer, self.diff_x, self.diff_y, tags)

    def determine_layer(self, tags, row):
        if 'prodist_type' in tags:
            pt = tags['prodist_type']
            if pt == 'HV': return LAYER_PRODIST_FAIXA_HV
            if pt == 'MT': return LAYER_PRODIST_FAIXA_MT
            return LAYER_PRODIST_FAIXA_BT

        if 'power' in tags and not pd.isna(tags['power']):
            if tags['power'] in ['line', 'tower', 'substation']: return LAYER_INFRA_POWER_HV
            return LAYER_INFRA_POWER_LV

        if 'telecom' in tags and not pd.isna(tags['telecom']): return LAYER_INFRA_TELECOM

        furniture_amenities = ['bench', 'waste_basket', 'bicycle_parking', 'fountain', 'drinking_water']
        if ('amenity' in tags and tags['amenity'] in furniture_amenities) or \
           ('highway' in tags and tags['highway'] == 'street_lamp'):
            return LAYER_MOBILIARIO_URBANO

        if 'building' in tags and not pd.isna(tags['building']): return LAYER_EDIFICACAO
        if 'highway' in tags and not pd.isna(tags['highway']): return LAYER_VIAS
        if 'natural' in tags and tags['natural'] in ['tree', 'wood', 'scrub']: return LAYER_VEGETACAO
        if 'amenity' in tags: return LAYER_EQUIPAMENTOS
        if 'leisure' in tags: return LAYER_VEGETACAO
        if 'waterway' in tags or ('natural' in tags and tags['natural'] == 'water'): return LAYER_HIDROGRAFIA
        return LAYER_DEFAULT

    def _safe_v(self, v, fallback_val=0.0):
        try:
            val = float(v)
            if math.isnan(val) or math.isinf(val) or abs(val) > 1e11: return fallback_val
            return val
        except: return fallback_val

    def _safe_p(self, p):
        return (self._safe_v(p[0]), self._safe_v(p[1]))

    def _validate_points(self, points, min_points=2):
        if not points or len(points) < min_points: return None
        v_pts = []
        for p in points:
            try:
                vals = [self._safe_v(v, None) for v in p]
                if None not in vals: v_pts.append(tuple(vals))
            except: continue
        return v_pts if len(v_pts) >= min_points else None

    def _draw_geometry(self, geom, layer, diff_x, diff_y, tags):
        if geom.is_empty: return
        if (layer == LAYER_VIAS) and 'name' in tags:
            name = str(tags['name'])
            if name.lower() != 'nan' and name.strip():
                c = geom.centroid
                if not c.is_empty:
                    self.msp.add_text(name, dxfattribs={'layer': LAYER_TEXTO, 'height': 2.5}).set_placement(
                        (self._safe_v(c.x-diff_x), self._safe_v(c.y-diff_y)), align=TextEntityAlignment.MIDDLE_CENTER)

        if isinstance(geom, Polygon): self._draw_polygon(geom, layer, diff_x, diff_y, tags)
        elif isinstance(geom, MultiPolygon):
            for poly in geom.geoms: self._draw_polygon(poly, layer, diff_x, diff_y, tags)
        elif isinstance(geom, LineString):
            self._draw_linestring(geom, layer, diff_x, diff_y, tags)
            if layer == LAYER_VIAS: self._draw_street_offsets(geom, tags, diff_x, diff_y)
        elif isinstance(geom, MultiLineString):
            for line in geom.geoms: self._draw_linestring(line, layer, diff_x, diff_y, tags)
        elif isinstance(geom, Point): self._draw_point(geom, layer, diff_x, diff_y, tags)

    def _draw_street_offsets(self, line, tags, dx, dy):
        h = tags.get('highway', 'residential')
        w = DXFStyleManager.get_street_width(h)
        try:
            for side in ['left', 'right']:
                off = line.parallel_offset(w, side, join_style=2)
                if not off.is_empty:
                    pts = [self._safe_p((p[0]-dx, p[1]-dy)) for p in off.coords]
                    self.msp.add_lwpolyline(pts, dxfattribs={'layer': LAYER_VIAS_MEIO_FIO, 'color': 251})
        except: pass

    def _draw_polygon(self, poly, layer, dx, dy, tags):
        pts = self._validate_points([self._safe_p((p[0]-dx, p[1]-dy)) for p in poly.exterior.coords], 3)
        if pts:
            e = self.msp.add_lwpolyline(pts, close=True, dxfattribs={'layer': layer, 'thickness': 3.5 if layer==LAYER_EDIFICACAO else 0})
            BIMDataEmbedder.embed_xdata(e, tags, layer)

    def _draw_linestring(self, line, layer, dx, dy, tags):
        pts = self._validate_points([self._safe_p((p[0]-dx, p[1]-dy)) for p in line.coords], 2)
        if pts:
            e = self.msp.add_lwpolyline(pts, close=False, dxfattribs={'layer': layer})
            BIMDataEmbedder.embed_xdata(e, tags, layer)

    def _draw_point(self, pt, layer, dx, dy, tags):
        x, y = self._safe_v(pt.x-dx), self._safe_v(pt.y-dy)
        if layer == LAYER_VEGETACAO: self.msp.add_blockref('ARVORE', (x, y))
        elif layer == LAYER_MOBILIARIO_URBANO:
            if tags.get('highway') == 'street_lamp': self.msp.add_blockref('POSTE_LUZ', (x, y))
            else: self.msp.add_circle((x, y), 0.3, dxfattribs={'layer': layer})
        elif 'INFRA_POWER' in layer or layer == LAYER_EQUIPAMENTOS: self.msp.add_blockref('POSTE', (x, y))
        else: self.msp.add_circle((x, y), 0.5, dxfattribs={'layer': layer})

    def add_terrain_from_grid(self, grid_rows):
        if not grid_rows: return
        r_count, c_count = len(grid_rows), len(grid_rows[0])
        mesh = self.msp.add_polymesh(size=(r_count, c_count), dxfattribs={'layer': 'TERRENO', 'color': 252})
        for r, row in enumerate(grid_rows):
            for c, p in enumerate(row):
                mesh.set_mesh_vertex((r, c), (p[0] - self.diff_x, p[1] - self.diff_y, p[2]))

    def add_drainage_lines(self, talwegs):
        for path in talwegs:
            p1, p2 = path
            x1, y1 = p1[0]-self.diff_x, p1[1]-self.diff_y
            x2, y2 = p2[0]-self.diff_x, p2[1]-self.diff_y
            self.msp.add_line((x1, y1), (x2, y2), dxfattribs={'layer': LAYER_HIDROGRAFIA_DRENAGEM})
            angle = math.atan2(y2-y1, x2-x1)
            ax, ay = x2 - 0.5*math.cos(angle-0.5), y2 - 0.5*math.sin(angle-0.5)
            bx, by = x2 - 0.5*math.cos(angle+0.5), y2 - 0.5*math.sin(angle+0.5)
            self.msp.add_lwpolyline([(ax, ay), (x2, y2), (bx, by)], dxfattribs={'layer': LAYER_HIDROGRAFIA_DRENAGEM})

    def add_contour_lines(self, contours):
        for line in contours:
            pts = [(p[0]-self.diff_x, p[1]-self.diff_y, p[2]) for p in line]
            self.msp.add_polyline3d(pts, dxfattribs={'layer': LAYER_TOPOGRAFIA_CURVAS})

    def save(self):
        try:
            self.doc.saveas(self.filename)
            Logger.info(f"DXF saved: {os.path.basename(self.filename)}")
        except Exception as e: Logger.error(f"DXF Save Error: {e}")
