
import numpy as np
from typing import Dict, Any

class SlopeStabilityAnalyzer:
    """
    Master-level slope stability analysis.
    Uses a simplified Factor of Safety (FoS) approach based on 
    infinite slope model parameters typical for soil/rock geotechnics.
    """

    @staticmethod
    def calculate_stability(elevation_grid: np.ndarray, cell_size: float) -> np.ndarray:
        """
        Calculates a 'Stability Index' or Factor of Safety proxy.
        0.0 = High Risk, 1.0 = Stable.
        """
        rows, cols = elevation_grid.shape
        dz_dx, dz_dy = np.gradient(elevation_grid, cell_size)
        slope = np.arctan(np.sqrt(dz_dx**2 + dz_dy**2))
        slope_deg = np.degrees(slope)

        # Simplified Factor of Safety (FoS) logic
        # FoS = (c + (gamma * h * cos^2(beta) - u) * tan(phi)) / (gamma * h * sin(beta) * cos(beta))
        # We use a proxy based on typical critical angles (beta)
        # Assuming phi (friction angle) ~ 30 deg for average soil
        
        phi_rad = np.radians(30.0)
        # Avoid division by zero for flat areas
        safe_slope = np.where(slope < 0.001, 0.001, slope)
        
        # FoS Proxy = tan(phi) / tan(beta)
        fos = np.tan(phi_rad) / np.tan(safe_slope)
        
        # Normalize to 0-1 range for visualization
        # < 1.0 is technically unstable
        stability_index = np.clip(fos / 1.5, 0, 1) # 1.5 is standard engineering safety margin
        
        return stability_index

    @staticmethod
    def classify_risk(stability_index: np.ndarray) -> np.ndarray:
        """
        Classifies stability into discrete risk levels (0-4).
        4: Stable, 3: Low Risk, 2: Moderate, 1: High Risk, 0: Critical
        """
        risk = np.zeros_like(stability_index, dtype=int)
        risk[stability_index > 0.9] = 4
        risk[(stability_index <= 0.9) & (stability_index > 0.7)] = 3
        risk[(stability_index <= 0.7) & (stability_index > 0.5)] = 2
        risk[(stability_index <= 0.5) & (stability_index > 0.3)] = 1
        risk[stability_index <= 0.3] = 0
        return risk
