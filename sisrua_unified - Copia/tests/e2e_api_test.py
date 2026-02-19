import requests
import time
import sys

BASE_URL = "http://localhost:3001"

def test_full_lifecycle():
    print("Testing Full Topography Job Lifecycle...")
    
    # 1. Submit Job
    payload = {
        "lat": -22.15018,
        "lng": -42.92185,
        "radius": 200,
        "quality": "balanced"
    }
    
    print(f"Submitting job for: {payload['lat']}, {payload['lng']}...")
    try:
        resp = requests.post(f"{BASE_URL}/api/topography/jobs", json=payload)
        resp.raise_for_status()
    except requests.exceptions.ConnectionError:
        print("ERROR: Could not connect to server. Is it running on port 3000?")
        sys.exit(1)
        
    data = resp.json()
    assert data["ok"] == True
    job_id = data["job"]["id"]
    print(f"Job submitted successfully. ID: {job_id}")

    # 2. Poll Status
    max_retries = 30
    retry_count = 0
    while retry_count < max_retries:
        print(f"Polling status (retry {retry_count+1}/30)...")
        status_resp = requests.get(f"{BASE_URL}/api/topography/jobs/{job_id}")
        status_data = status_resp.json()
        
        status = status_data["job"]["status"]
        if status == "completed":
            print("Job completed!")
            break
        elif status == "failed":
            print(f"ERROR: Job failed: {status_data['job'].get('error')}")
            sys.exit(1)
        
        time.sleep(2)
        retry_count += 1
    else:
        print("ERROR: Job timed out.")
        sys.exit(1)

    # 3. Verify Result
    result = status_data["job"]["result"]
    assert "analysis" in result
    assert "elevation_grid" in result["analysis"]
    assert "slope" in result["analysis"]
    assert "aspect" in result["analysis"]
    assert "filename" in result
    assert "stl_filename" in result # Master tool verification

    print("Result validation passed.")

    # 4. Verify Download
    print("Verifying DXF Download...")
    try:
        dxf_resp = requests.get(f"{BASE_URL}/api/topography/download/{job_id}")
        if dxf_resp.status_code != 200:
            print(f"ERROR: DXF Download failed with status {dxf_resp.status_code}")
            print(dxf_resp.text)
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: DXF Download exception: {e}")
        sys.exit(1)

    print("Verifying STL Download...")
    try:
        stl_resp = requests.get(f"{BASE_URL}/api/topography/download/{job_id}?format=stl")
        if stl_resp.status_code != 200:
            print(f"ERROR: STL Download failed with status {stl_resp.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: STL Download exception: {e}")
        sys.exit(1)

    print("E2E Test PASSED successfully!")

if __name__ == "__main__":
    test_full_lifecycle()
