import numpy as np
from typing import List, Dict, Any

class HydrologyService:
    """Domain service for hydrological analysis (Talwegs and Flow)."""
    
    @staticmethod
    def extract_talwegs(z_grid: np.ndarray, dx: float, dy: float, threshold: float = 0.5) -> List[List[List[float]]]:
        """
        Identify natural drainage lines (talwegs) based on surface convergence.
        Simplified approach: find cells with high negative curvature in the direction of the slope.
        """
        rows, cols = z_grid.shape
        # Calculate gradients
        grad_y, grad_x = np.gradient(z_grid, dy, dx)
        
        # Calculate second derivatives (curvature)
        grad_yy, grad_yx = np.gradient(grad_y, dy, dx)
        grad_xy, grad_xx = np.gradient(grad_x, dy, dx)
        
        # Total curvature (Laplacian) - areas of high positive Laplacian are 'valleys' (talwegs)
        laplacian = grad_xx + grad_yy
        
        # We look for lines where water accumulates (valleys)
        # Thresholding the laplacian to find "valley" areas
        talweg_mask = laplacian > threshold
        
        # Convert mask to paths (simplified: group nearby points)
        # In a real GIS, we'd use flow accumulation, but here we'll return point clusters as line segments
        paths = []
        for r in range(1, rows - 1):
            for c in range(1, cols - 1):
                if talweg_mask[r, c]:
                    # Create short segments following the gradient
                    p1 = [c * dx, r * dy]
                    # Direct downstream
                    vx, vy = -grad_x[r, c], -grad_y[r, c]
                    mag = np.sqrt(vx**2 + vy**2)
                    if mag > 0:
                        p2 = [p1[0] + (vx/mag) * dx, p1[1] + (vy/mag) * dy]
                        paths.append([p1, p2])
                        
        return paths
