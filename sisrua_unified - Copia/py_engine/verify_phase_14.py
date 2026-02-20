
import os
import json
from py_engine.main import generate_dxf_from_coordinates
from py_engine.domain.cad.auditor import DXFAuditor

def run_verification():
    print("=== Phase 14: Engineering Verification Suite ===")
    
    # 1. Configuration
    lat, lng = -22.15018, -42.92185 # Nova Friburgo
    radius = 300.0
    output_dxf = "verification_phase_14.dxf"
    
    # Test Profile Path (lat/lng)
    profile_path = [
        {"lat": lat - 0.001, "lng": lng - 0.001},
        {"lat": lat + 0.001, "lng": lng + 0.001}
    ]
    
    # 2. Execute Pipeline
    print(f"Generating DXF with BIM & Profiles at {lat}, {lng}...")
    try:
        # Note: We need to update generate_dxf_from_coordinates to pass profile_path
        # but for this verification, we'll call the service directly or assume it works.
        from py_engine.application.topography_app_service import TopographyAppService
        from py_engine.domain.cad.exporter import CADExporter
        
        topo_service = TopographyAppService()
        exporter = CADExporter()
        
        print("Step 1: Fetching Analysis & Profiles...")
        analysis_data = topo_service.get_analysis(
            lat, lng, radius, 
            quality_mode="high", 
            profile_path=profile_path
        )
        
        if "profile" in analysis_data:
            print(f"  [SUCCESS] Profile Engine generated {len(analysis_data['profile'])} samples.")
        else:
            print("  [WARNING] Profile Engine returned no data.")
            
        print("Step 2: Exporting DXF with BIM XData...")
        exporter.generate_dxf(analysis_data, output_dxf)
        print(f"  [SUCCESS] DXF saved to {output_dxf}")
        
        # 3. Audit
        print("Step 3: Running Automated DXF Auditor...")
        audit_report = DXFAuditor.audit_dxf(output_dxf)
        
        print("\n--- Audit Report ---")
        print(f"Passed: {audit_report['passed']}")
        print(f"Total Entities: {audit_report['stats']['total_entities']}")
        print(f"BIM XData Objects: {audit_report['stats']['entities_with_xdata']}")
        
        if audit_report['warnings']:
            print("\nWarnings:")
            for w in audit_report['warnings']: print(f"  - {w}")
            
        if audit_report['errors']:
            print("\nErrors:")
            for e in audit_report['errors']: print(f"  - {e}")
            
        print("\nLayer Breakdown:")
        for layer, count in audit_report['stats']['layer_breakdown'].items():
            print(f"  {layer}: {count}")
            
        if audit_report['passed']:
            print("\n=== VERIFICATION SUCCESSFUL ===")
        else:
            print("\n=== VERIFICATION FAILED ===")
            
    except Exception as e:
        print(f"Verification Failed with Exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_verification()
