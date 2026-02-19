"""
Topographic analysis reports and insights.
Generates comprehensive terrain analysis summaries for professionals.
"""

import json
from typing import Dict, List, Any
from dataclasses import asdict
from datetime import datetime


class TopographyReport:
    """Generate professional topography analysis reports."""
    
    @staticmethod
    def generate_summary(
        terrain_metrics: Any,  # TerrainMetrics dataclass
        location_name: str = "Survey Area",
        analysis_type: str = "Satellite DEM"
    ) -> Dict[str, Any]:
        """
        Generate comprehensive topography summary report.
        """
        metrics = asdict(terrain_metrics) if hasattr(terrain_metrics, '__dataclass_fields__') else {}
        
        min_elev, max_elev = metrics.get('elevation_range', (0, 0))
        mean_elev = metrics.get('mean_elevation', 0)
        
        return {
            "metadata": {
                "location": location_name,
                "analysis_type": analysis_type,
                "timestamp": datetime.now().isoformat(),
                "version": "2.0"
            },
            "elevation_summary": {
                "minimum_elevation": float(min_elev),
                "maximum_elevation": float(max_elev),
                "mean_elevation": float(mean_elev),
                "relief": float(max_elev - min_elev),
                "unit": "meters"
            },
            "slope_analysis": {
                "mean_slope": float(metrics.get('mean_slope', 0)),
                "maximum_slope": float(metrics.get('max_slope', 0)),
                "slope_roughness": float(metrics.get('surface_roughness', 0)),
                "unit": "degrees"
            },
            "terrain_character": {
                "terrain_ruggedness_index": float(metrics.get('terrain_ruggedness', 0)),
                "interpretation": TopographyReport._interpret_tri(metrics.get('terrain_ruggedness', 0))
            },
            "recommendations": TopographyReport._generate_recommendations(terrain_metrics)
        }
    
    @staticmethod
    def _interpret_tri(tri: float) -> str:
        """Interpret Terrain Ruggedness Index value."""
        if tri < 10:
            return "Very smooth - minimal elevation variation"
        elif tri < 50:
            return "Smooth - gentle rolling terrain"
        elif tri < 150:
            return "Moderate - mixed slopes and valleys"
        elif tri < 300:
            return "Rugged - significant elevation changes"
        else:
            return "Very rugged - highly complex terrain"
    
    @staticmethod
    def _generate_recommendations(terrain_metrics: Any) -> List[str]:
        """
        Generate recommendations based on terrain analysis.
        """
        recommendations = []
        
        metrics = asdict(terrain_metrics) if hasattr(terrain_metrics, '__dataclass_fields__') else {}
        mean_slope = metrics.get('mean_slope', 0)
        mean_elev = metrics.get('mean_elevation', 0)
        tri = metrics.get('terrain_ruggedness', 0)
        
        # Slope recommendations
        if mean_slope < 2:
            recommendations.append("Terrain is very flat - suitable for infrastructure development")
        elif mean_slope < 10:
            recommendations.append("Moderate slopes - good for most construction projects")
        else:
            recommendations.append("Steep slopes - use specialized engineering for construction")
        
        # Elevation recommendations
        if mean_elev > 2000:
            recommendations.append("High altitude area - consider oxygen levels and climate effects")
        elif mean_elev < -10:
            recommendations.append("Below sea level or water body - verify data accuracy")
        
        # Ruggedness recommendations
        if tri > 200:
            recommendations.append("Complex terrain - detailed site surveys recommended")
            recommendations.append("Consider drone-based surveying for accuracy")
        
        recommendations.append("Data sourced from satellite elevation models - validate against ground surveys")
        
        return recommendations
    
    @staticmethod
    def generate_json_report(
        terrain_metrics: Any,
        location_name: str = "Survey Area",
        output_path: str = None
    ) -> str:
        """
        Generate JSON report suitable for API responses.
        """
        summary = TopographyReport.generate_summary(terrain_metrics, location_name)
        json_str = json.dumps(summary, indent=2)
        
        if output_path:
            with open(output_path, 'w') as f:
                f.write(json_str)
        
        return json_str
    
    @staticmethod
    def classify_slope_percentages(
        slope_grid: List[List[float]]
    ) -> Dict[str, float]:
        """
        Calculate percentage of terrain in each slope class.
        """
        import numpy as np
        
        slope_array = np.array(slope_grid)
        total = slope_array.size
        
        return {
            "flat_0_2": float((slope_array <= 2).sum() / total * 100),
            "gentle_2_5": float(((slope_array > 2) & (slope_array <= 5)).sum() / total * 100),
            "moderate_5_15": float(((slope_array > 5) & (slope_array <= 15)).sum() / total * 100),
            "steep_15_30": float(((slope_array > 15) & (slope_array <= 30)).sum() / total * 100),
            "very_steep_30_plus": float((slope_array > 30).sum() / total * 100)
        }
    
    @staticmethod
    def classify_aspect_distribution(
        aspect_grid: List[List[float]]
    ) -> Dict[str, float]:
        """
        Calculate percentage of terrain facing each direction.
        """
        import numpy as np
        
        aspect_array = np.array(aspect_grid)
        total = aspect_array.size
        
        # Eight cardinal directions
        directions = {
            "North": ((aspect_array >= 337.5) | (aspect_array < 22.5)).sum(),
            "NE": ((aspect_array >= 22.5) & (aspect_array < 67.5)).sum(),
            "East": ((aspect_array >= 67.5) & (aspect_array < 112.5)).sum(),
            "SE": ((aspect_array >= 112.5) & (aspect_array < 157.5)).sum(),
            "South": ((aspect_array >= 157.5) & (aspect_array < 202.5)).sum(),
            "SW": ((aspect_array >= 202.5) & (aspect_array < 247.5)).sum(),
            "West": ((aspect_array >= 247.5) & (aspect_array < 292.5)).sum(),
            "NW": ((aspect_array >= 292.5) & (aspect_array < 337.5)).sum(),
        }
        
        return {k: float(v / total * 100) for k, v in directions.items()}
