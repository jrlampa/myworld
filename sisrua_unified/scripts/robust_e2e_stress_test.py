import sys
from pyproj import Transformer
import subprocess
import os
import json

def utm_to_latlon(easting, northing, zone, southern_hemisphere=True):
    # Zone 24S or 24K (likely Brazil)
    proj_str = f"+proj=utm +zone={zone} {'+south' if southern_hemisphere else ''} +ellps=GRS80 +units=m +no_defs"
    transformer = Transformer.from_crs(proj_str, "epsg:4326", always_xy=True)
    lon, lat = transformer.transform(easting, northing)
    return lat, lon

def run_robust_audit():
    print("=== Super-Robust E2E Stress Test Starting ===")
    
    # Coordinates provided by user: 24K 0216330 7528658
    # K is often used for S latitude bands. Most of Brazil is South.
    easting = 216330
    northing = 7528658
    zone = 24
    
    lat, lon = utm_to_latlon(easting, northing, zone)
    print(f"Converted Coordinates: Lat {lat:.6f}, Lon {lon:.6f}")
    
    # 1. Build Final Engine
    print("Step 1: Building production engine...")
    subprocess.run(["python", "-m", "PyInstaller", "--noconfirm", "py_engine/engine.spec"], check=True)
    
    # 2. Setup Distribution
    os.makedirs("dist/engine", exist_ok=True)
    if os.path.exists("dist/sisrua_engine.exe"):
        os.replace("dist/sisrua_engine.exe", "dist/engine/sisrua_engine.exe")

    # 3. Generate Large-Scale DXF (2km radius)
    print(f"Step 2: Generating 2km Stress-Test DXF at {lat}, {lon}...")
    output_dxf = "dist/stress_test_2km_24k.dxf"
    # Note: 2km radius is 4km diameter. Significant data volume.
    cmd = [
        "dist/engine/sisrua_engine.exe",
        "--lat", str(lat),
        "--lon", str(lon),
        "--radius", "2000",
        "--output", output_dxf,
        "--client_name", "SUPER_ROBUST_AUDIT",
        "--project_id", "STRESS_2KM_24K",
        "--no-preview"
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print("ENGINE FAILURE!")
        print(result.stderr)
        sys.exit(1)
    
    print("Step 3: DXF Generation Success!")
    
    # 4. AutoCAD Headless Audit
    print("Step 4: Running AutoCAD Headless Audit for Blueprint Certification...")
    audit_cmd = ["powershell", "-ExecutionPolicy", "Bypass", "-File", "scripts/verify_dxf_headless.ps1", "-DxfPath", output_dxf]
    audit_result = subprocess.run(audit_cmd, capture_output=True, text=True)
    
    print(audit_result.stdout)
    if "FAIL" in audit_result.stdout:
        print("AUDIT FAILURE: DXF contains geometric errors or inconsistencies.")
        sys.exit(1)
        
    print("=== CERTIFICATION PASS: Engine is Production Ready ===")

if __name__ == "__main__":
    run_robust_audit()
