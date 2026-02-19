"""
Multi-format terrain export: STL (3D printing), GeoTIFF, and enhanced DXF.
Enables professional-grade topographic visualization and analysis.
"""

import struct
import numpy as np
from typing import List, Tuple, Optional
from pathlib import Path


class TerrainExporter:
    """Export elevation data in multiple professional formats."""
    
    @staticmethod
    def export_stl(
        grid: np.ndarray,  # 2D elevation array
        output_path: str,
        cell_size: float = 30.0,
        vertical_scale: float = 1.0,
        name: str = "Terrain"
    ) -> bool:
        """
        Export terrain as STL (Stereolithography) for 3D printing.
        
        Creates a mesh with vertices at grid points and faces for each cell.
        
        Args:
            grid: 2D elevation array
            output_path: Path to output .stl file
            cell_size: Horizontal cell size in meters
            vertical_scale: Vertical exaggeration factor
            name: Name for STL solid
        
        Returns:
            True if successful
        """
        try:
            rows, cols = grid.shape
            
            # Normalize and scale elevation data
            min_elev = np.nanmin(grid)
            max_elev = np.nanmax(grid)
            elev_range = max_elev - min_elev if max_elev > min_elev else 1.0
            
            # Scaled grid for 3D
            scaled = ((grid - min_elev) / elev_range) * 100 * vertical_scale
            
            # Generate vertices
            vertices = []
            vertex_indices = {}
            
            for i in range(rows):
                for j in range(cols):
                    if np.isnan(scaled[i, j]):
                        vertex_indices[(i, j)] = -1
                        continue
                    
                    x = j * cell_size / 1000  # Convert to km
                    y = i * cell_size / 1000  # Convert to km
                    z = float(scaled[i, j])
                    
                    vertices.append((x, y, z))
                    vertex_indices[(i, j)] = len(vertices) - 1
            
            # Generate triangles (two per cell)
            triangles = []
            
            for i in range(rows - 1):
                for j in range(cols - 1):
                    # Four corners of cell
                    corners = [
                        vertex_indices.get((i, j), -1),
                        vertex_indices.get((i, j+1), -1),
                        vertex_indices.get((i+1, j+1), -1),
                        vertex_indices.get((i+1, j), -1)
                    ]
                    
                    # Skip if any corner is invalid
                    if -1 in corners:
                        continue
                    
                    # Two triangles per cell
                    triangles.append((corners[0], corners[1], corners[2]))
                    triangles.append((corners[0], corners[2], corners[3]))
            
            # Write binary STL
            with open(output_path, 'wb') as f:
                # 80-byte header
                header = name.encode('utf-8')[:80]
                f.write(header + b'\0' * (80 - len(header)))
                
                # Number of triangles
                f.write(struct.pack('<I', len(triangles)))
                
                # Triangle data
                for v1_idx, v2_idx, v3_idx in triangles:
                    v1 = vertices[v1_idx]
                    v2 = vertices[v2_idx]
                    v3 = vertices[v3_idx]
                    
                    # Calculate normal
                    edge1 = np.array([v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]])
                    edge2 = np.array([v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]])
                    normal = np.cross(edge1, edge2)
                    norm_len = np.linalg.norm(normal)
                    if norm_len > 0:
                        normal = normal / norm_len
                    
                    # Write triangle
                    f.write(struct.pack('<fff', *normal))  # Normal
                    f.write(struct.pack('<fff', *v1))      # Vertex 1
                    f.write(struct.pack('<fff', *v2))      # Vertex 2
                    f.write(struct.pack('<fff', *v3))      # Vertex 3
                    f.write(struct.pack('<H', 0))          # Attribute byte count
            
            return True
        
        except Exception as e:
            print(f"[STL] Export error: {e}")
            return False
    
    @staticmethod
    def export_geotiff(
        grid: np.ndarray,
        output_path: str,
        bounds: Tuple[float, float, float, float],  # (min_lat, min_lon, max_lat, max_lon)
        crs: str = "EPSG:4326"
    ) -> bool:
        """
        Export terrain as GeoTIFF with geospatial metadata.
        
        Requires rasterio library.
        
        Args:
            grid: 2D elevation array
            output_path: Path to output .tif file
            bounds: (min_lat, min_lon, max_lat, max_lon)
            crs: Coordinate reference system
        
        Returns:
            True if successful
        """
        try:
            import rasterio
            from rasterio.transform import Affine
        except ImportError:
            print("[GeoTIFF] rasterio not installed. Skipping GeoTIFF export.")
            return False
        
        try:
            rows, cols = grid.shape
            min_lat, min_lon, max_lat, max_lon = bounds
            
            # Create transform (georeference)
            transform = Affine.translation(min_lon, max_lat) * Affine.scale(
                (max_lon - min_lon) / cols,
                -(max_lat - min_lat) / rows
            )
            
            # Write GeoTIFF
            with rasterio.open(
                output_path,
                'w',
                driver='GTiff',
                height=rows,
                width=cols,
                count=1,
                dtype=grid.dtype,
                crs=crs,
                transform=transform,
                nodata=np.nan
            ) as dst:
                dst.write(grid, 1)
            
            return True
        
        except Exception as e:
            print(f"[GeoTIFF] Export error: {e}")
            return False
    
    @staticmethod
    def export_slope_map(
        slope_grid: np.ndarray,
        output_path: str,
        color_map: Optional[list] = None
    ) -> bool:
        """
        Export slope analysis as PNG with color mapping.
        
        Requires PIL/Pillow.
        """
        try:
            from PIL import Image
        except ImportError:
            print("[PNG] PIL not installed. Skipping slope map export.")
            return False
        
        try:
            # Normalize to 0-255
            normalized = ((slope_grid - np.nanmin(slope_grid)) / 
                         (np.nanmax(slope_grid) - np.nanmin(slope_grid)) * 255)
            normalized = np.nan_to_num(normalized, nan=0.0).astype(np.uint8)
            
            # Create image
            img = Image.fromarray(normalized, mode='L')
            
            # Optional color mapping (e.g., with rasterio colormap)
            if color_map:
                img = img.convert('RGB')
            
            img.save(output_path)
            return True
        
        except Exception as e:
            print(f"[PNG] Export error: {e}")
            return False
    
    @staticmethod
    def export_ascii_grid(
        grid: np.ndarray,
        output_path: str,
        bounds: Tuple[float, float, float, float],  # (min_x, min_y, max_x, max_y)
        cell_size: float = 30.0
    ) -> bool:
        """
        Export as ASCII Grid (.asc) format.
        Compatible with ArcGIS and many GIS tools.
        """
        try:
            rows, cols = grid.shape
            min_x, min_y, max_x, max_y = bounds
            
            with open(output_path, 'w') as f:
                # Write header
                f.write(f"ncols {cols}\n")
                f.write(f"nrows {rows}\n")
                f.write(f"xllcorner {min_x}\n")
                f.write(f"yllcorner {min_y}\n")
                f.write(f"cellsize {cell_size}\n")
                f.write(f"NODATA_value {-9999}\n")
                
                # Write data
                for row in grid:
                    values = ' '.join(str(v) if not np.isnan(v) else '-9999' for v in row)
                    f.write(f"{values}\n")
            
            return True
        
        except Exception as e:
            print(f"[ASCII] Export error: {e}")
            return False
