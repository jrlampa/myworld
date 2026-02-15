import pyproj
import subprocess
import os
import json

def generate_live_test():
    # 1. UTM Coordinates
    easting = 208906
    northing = 7520980
    zone = 24
    south = True # 'K' latitude band is Southern Hemisphere
    
    # Define UTM CRS (EPSG:32724 for Zone 24S)
    utm_crs = f"+proj=utm +zone={zone} +south +ellps=WGS84 +datum=WGS84 +units=m +no_defs"
    wgs84_crs = "EPSG:4326"
    
    transformer = pyproj.Transformer.from_crs(utm_crs, wgs84_crs, always_xy=True)
    lon, lat = transformer.transform(easting, northing)
    
    print(f"Converted UTM {zone}K {easting} {northing} to Lat: {lat:.6f}, Lon: {lon:.6f}")
    
    # 2. Setup paths
    output_dir = r"C:\Users\Jonatas Lampa\Downloads"
    output_file = os.path.join(output_dir, "extracao_live_test.dxf")
    
    # 3. Call main.py
    cmd = [
        "python", "main.py",
        "--lat", str(lat),
        "--lon", str(lon),
        "--radius", "500",
        "--output", output_file,
        "--layers", json.dumps({"buildings": True, "roads": True, "trees": True, "amenities": True, "terrain": True}),
        "--client_name", "VERIFICAÇÃO LIVE",
        "--project_id", "TESTE-UTM-24K",
        "--no-preview"
    ]
    
    print(f"Running engine for {output_file} (no-preview mode)...")
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        for line in process.stdout:
            print(line, end='')
        process.wait()
        if process.returncode != 0:
            print(f"Engine failed with return code {process.returncode}")
    except Exception as e:
        print(f"Test runner error: {e}")

if __name__ == "__main__":
    # Ensure we are in the right directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    generate_live_test()
