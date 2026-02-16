import ezdxf
import sys
import os

def audit_file(filename):
    if not os.path.exists(filename):
        print(f"File not found: {filename}")
        return
    
    try:
        doc = ezdxf.readfile(filename)
        auditor = doc.audit()
        if auditor.has_errors:
            print(f"Found {len(auditor.errors)} errors in {filename}")
            for error in auditor.errors:
                print(f"  - {error.code}: {error.message}")
        else:
            print(f"No errors found in {filename}")
    except Exception as e:
        print(f"Failed to read/audit file: {e}")

if __name__ == "__main__":
    # Audit latest dxf in public/dxf
    dxf_dir = 'c:/myworld/sisrua_unified/public/dxf'
    files = [f for f in os.listdir(dxf_dir) if f.endswith('.dxf')]
    if not files:
        print("No DXF files found to audit.")
    else:
        files.sort(key=lambda x: os.path.getmtime(os.path.join(dxf_dir, x)), reverse=True)
        latest = os.path.join(dxf_dir, files[0])
        print(f"Auditing latest file: {latest}")
        audit_file(latest)
