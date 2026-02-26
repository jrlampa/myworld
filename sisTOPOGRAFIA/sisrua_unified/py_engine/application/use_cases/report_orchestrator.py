"""
Use Case: ReportOrchestratorUseCase
Responsabilidade única: construir dados do relatório técnico e delegar ao PDF adapter.
"""
import geopandas as gpd
from typing import Dict, Optional, List
import sys
import os

try:
    from infrastructure.pdf.pdf_adapter import generate_report
    from utils.logger import Logger
except ImportError:
    # Handle cases where sys.path might not include the root
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
    from infrastructure.pdf.pdf_adapter import generate_report
    from utils.logger import Logger

class ReportOrchestratorUseCase:
    """
    Coleta estatísticas da área e delega a geração do PDF técnico ao report_generator.
    """

    def __init__(self, output_file: str, project_metadata: Dict, lat: float, lon: float):
        self.output_file = output_file
        self.project_metadata = project_metadata
        self.lat = lat
        self.lon = lon

    def generate(self, gdf: gpd.GeoDataFrame,
                 analytics_res: Optional[Dict] = None) -> None:
        """Gera PDF técnico com dados da análise."""
        try:
            pdf_file = self.output_file.replace('.dxf', '_laudo.pdf')
            report_data = self._build_report_data(gdf, analytics_res)
            generate_report(report_data, pdf_file)
            Logger.info(f"Laudo técnico gerado: {pdf_file}")
        except Exception as e:
            Logger.info(f"Geração do laudo falhou: {e}", "warning")

    def _build_report_data(self, gdf: gpd.GeoDataFrame,
                           analytics_res: Optional[Dict]) -> Dict:
        """Constrói dicionário de dados para o relatório."""
        return {
            'project_name': self.project_metadata.get('project', 'BASE TOPOGRÁFICA'),
            'client': self.project_metadata.get('client', 'CLIENTE PADRÃO'),
            'location_label': f"{self.lat}, {self.lon}",
            'stats': {
                'avg_slope': analytics_res['slope_avg'] if analytics_res and 'slope_avg' in analytics_res else 8.4,
                'min_height': self._safe_centroid_stat(gdf, 'z', 'min'),
                'max_height': self._safe_centroid_stat(gdf, 'z', 'max'),
                'total_buildings': int(gdf[gdf['building'].notna()].shape[0]) if 'building' in gdf.columns else 0,
                'total_road_length': float(gdf[gdf['highway'].notna()].geometry.length.sum()) if 'highway' in gdf.columns else 0.0,
                'total_nature': int(gdf[gdf['natural'].notna()].shape[0]) if 'natural' in gdf.columns else 0,
                'total_building_area': float(gdf[gdf['building'].notna()].geometry.area.sum()) if 'building' in gdf.columns else 0.0,
                'cut_volume': float(analytics_res['earthwork']['cut_volume']) if analytics_res and 'earthwork' in analytics_res else 0.0,
                'fill_volume': float(analytics_res['earthwork']['fill_volume']) if analytics_res and 'earthwork' in analytics_res else 0.0,
            }
        }

    @staticmethod
    def _safe_centroid_stat(gdf: gpd.GeoDataFrame, attr: str, stat: str) -> float:
        try:
            centroids = gdf.geometry.centroid
            # In projected CRS, centroid has .x and .y. Elevation might be in a separate column or Z coordinate.
            if attr == 'z' and 'z' in gdf.columns:
                vals = gdf['z']
                return float(vals.min() if stat == 'min' else vals.max())
        except Exception:
            pass
        return 0.0
