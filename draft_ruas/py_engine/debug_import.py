import sys
import os
# sys.path.append(os.path.dirname(os.path.abspath(__file__)))
try:
    print(f"Sys Path: {sys.path}")
    import elevation_client
    print("Import SUCCESS")
except Exception as e:
    print(f"Import FAILED: {e}")
