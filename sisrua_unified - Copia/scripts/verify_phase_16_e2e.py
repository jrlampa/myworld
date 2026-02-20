import sys
import os
from pathlib import Path

# Use absolute package imports
from py_engine.application.topography_app_service import TopographyAppService
from py_engine.domain.cad.exporter import CADExporter

def verify_phase_16():
    print("🚀 Starting Phase 16 Verification: E2E BIM Pipeline")
    
    service = TopographyAppService()
    lat, lng = -22.2858, -42.5332 # Nova Friburgo
    radius = 300
    
    print(f"📡 Step 1: Fetching and Analyzing Topography for {lat}, {lng}...")
    result = service.get_analysis(lat, lng, radius, quality_mode="high")
    
    if not result or "analysis" not in result:
        print("❌ Error: Analysis failed")
        return
    
    print("✅ Step 1: Analysis Successful")
    
    print("✍️ Step 2: Exporting to BIM-Enabled DXF...")
    exporter = CADExporter()
    output_path = "phase_16_verification.dxf"
    
    exporter.generate_dxf(result, output_path)
    
    if not Path(output_path).exists():
        print("❌ Error: DXF export failed")
        return
    
    print(f"✅ Step 2: DXF Exported to {output_path} ({os.path.getsize(output_path)} bytes)")
    
    print("🔍 Step 3: Running Automated Compliance Audit...")
    # Import the test function from our script
    sys.path.append(str(Path(__file__).parent.parent / "scripts"))
    from dxf_compliance_test import test_dxf_compliance
    
    # We need to capture output to check results
    import io
    from contextlib import redirect_stdout
    
    f = io.StringIO()
    with redirect_stdout(f):
        try:
            test_dxf_compliance(output_path)
        except SystemExit:
            pass # Expecting sys.exit(1) on failure
            
    audit_output = f.getvalue()
    print(audit_output)
    
    if "🏆 DXF Compliance Audit: PASSED" in audit_output:
        print("\n✨ PHASE 16 INTEGRATION VERIFIED: CAD-BIM PIPELINE IS OPERATIONAL")
    else:
        print("\n❌ PHASE 16 VERIFICATION FAILED: DXF DOES NOT MEET COMPLIANCE STANDARDS")
        sys.exit(1)

if __name__ == "__main__":
    verify_phase_16()
