
import sys
import os
import json
import numpy as np

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from py_engine.application.topography_app_service import TopographyAppService

def test_phase_15_analytics():
    print("🚀 Starting Phase 15 Analytics Verification...")
    
    service = TopographyAppService()
    
    # Nova Friburgo Coordinates
    lat, lng = -22.15018, -42.92185
    radius = 500
    
    print(f"📡 Requesting analysis for {lat}, {lng} (Radius: {radius}m)")
    result = service.get_analysis(lat, lng, radius, quality_mode="balanced")
    
    analysis = result.get('analysis', {})
    
    # Check new fields
    new_fields = ['stability_index', 'plan_curvature', 'profile_curvature']
    success = True
    
    for field in new_fields:
        if field in analysis and analysis[field] is not None:
            data = np.array(analysis[field])
            print(f"✅ {field} found. Shape: {data.shape}, Min: {np.min(data):.4f}, Max: {np.max(data):.4f}")
        else:
            print(f"❌ {field} MISSING or None")
            success = False
            
    # Metadata check
    if 'earthworks' in result:
         print(f"✅ Earthworks data found.")
    else:
         print(f"❌ Earthworks data MISSING")
         success = False

    if success:
        print("\n🏆 Phase 15 Backend Verification PASSED!")
    else:
        print("\n⚠️ Phase 15 Backend Verification FAILED!")
        sys.exit(1)

if __name__ == "__main__":
    test_phase_15_analytics()
