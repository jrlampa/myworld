import sys
import os
import numpy as np

# Add py_engine to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'py_engine')))

try:
    from utils.topographic_analysis import TopographicAnalyzer
except ImportError:
    # Fallback for direct execution
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    from py_engine.utils.topographic_analysis import TopographicAnalyzer

def test_hydrology():
    print("Testing TopographicAnalyzer Hydrology...")
    
    # 1. Simple V-Shape Valley (3x3)
    # 10 10 10
    # 5  0  5
    # 2  -1 2  <- Water should flow to center (-1)
    
    # Actually, simpler:
    # 2 2 2
    # 1 0 1
    # 0 0 0
    
    # Make a 5x5 grid with a central channel
    grid = np.array([
        [10, 8, 5, 8, 10],
        [10, 8, 4, 8, 10],
        [10, 8, 3, 8, 10],
        [10, 8, 2, 8, 10],
        [10, 8, 1, 8, 10]
    ], dtype=float)
    
    print("Grid:\n", grid)
    
    # Calculate Direction
    flow_dir = TopographicAnalyzer.calculate_flow_direction(grid)
    print("Flow Direction:\n", flow_dir)
    
    # Center column (idx 2) should flow SOUTH (4) or depends on neighbor checks
    # (1, 2) is 4. Neighbor (2, 2) is 3. Drop is 1.
    # (1, 2) neighbors: (2,2)=3, (2,1)=8, (2,3)=8.
    # Steepest drop is to (2,2) [4->3].
    # So center column should flow South (4).
    
    # Calculate Accumulation
    flow_acc = TopographicAnalyzer.calculate_flow_accumulation(flow_dir)
    print("Flow Accumulation:\n", flow_acc)
    
    # The bottom-center cell (4, 2) should have high accumulation.
    # Cells above it flow into it. 
    # (0,2)->(1,2)->(2,2)->(3,2)->(4,2)
    # Also sides flow into center?
    # (0,1)=8 -> flows to (something lower). (0,1)=8, (1,1)=8, (0,2)=5.
    # Drop to (0,2) is 3. Drop to (1,1) is 0.
    # So (0,1) flows to (0,2) [East=1].
    # (0,2) flows South.
    
    center_bottom_acc = flow_acc[4, 2]
    print(f"Bottom Center Accumulation: {center_bottom_acc}")
    
    if center_bottom_acc < 3:
        print("❌ Accumulation logic suspicious. Expected higher value at sink.")
        sys.exit(1)
        
    print("✓ Hydrology Verification Passed")

if __name__ == "__main__":
    test_hydrology()
