
import ezdxf
from typing import Dict, List, Any

class DXFAuditor:
    """
    Automated auditor for DXF compliance.
    Checks for layer standards, BIM XData, and geometric integrity.
    """
    
    REQUIRED_LAYERS = [
        "TOPO_AOI", "TOPO_ELEV", "TOPO_CONT_MINR", "TOPO_CONT_MAJR", 
        "TOPO_BLDG", "TOPO_ROAD", "TOPO_HYDR_STRM", "TOPO_HYDR_BASN"
    ]
    

    @staticmethod
    def audit_dxf(file_path: str) -> Dict[str, Any]:
        """
        Performs a deep compliance audit on a DXF file.
        Returns a report with errors, warnings, and statistics.
        """
        # Explicit type initialization to avoid linting confusion
        results: Dict[str, Any] = {
            "passed": True,
            "errors": [],
            "warnings": [],
            "stats": {
                "layers": 0,
                "entities_with_xdata": 0,
                "total_entities": 0,
                "layer_breakdown": {}
            }
        }
        
        try:
            doc = ezdxf.readfile(file_path)
            msp = doc.modelspace()
            
            # 1. Layer Audit
            existing_layers = [l.dxf.name for l in doc.layers]
            results["stats"]["layers"] = len(existing_layers)
            
            for req in DXFAuditor.REQUIRED_LAYERS:
                if req not in existing_layers:
                    results["warnings"].append(f"Missing recommended engineering layer: {req}")
            
            # 2. Entity & XData Audit
            entities = list(msp)
            results["stats"]["total_entities"] = len(entities)
            
            for entity in entities:
                layer = entity.dxf.layer
                results["stats"]["layer_breakdown"][layer] = results["stats"]["layer_breakdown"].get(layer, 0) + 1
                
                if entity.has_xdata("SISRUA_BIM"):
                    results["stats"]["entities_with_xdata"] += 1
            
            if results["stats"]["entities_with_xdata"] == 0:
                results["warnings"].append("No BIM XData (SISRUA_BIM) found. Engineering attributes are missing.")
                
            # 3. Geometric Integrity Audit
            for entity in entities:
                if entity.dxftype() == 'LWPOLYLINE':
                    try:
                         points = entity.get_points()
                         if len(points) == 0:
                            results["errors"].append(f"Metadata Error: Empty LWPOLYLINE on layer {layer}")
                            results["passed"] = False
                    except Exception:
                        results["errors"].append("Geometric Corruption: Could not read points for LWPOLYLINE")
                        results["passed"] = False

        except Exception as e:
            results["passed"] = False
            results["errors"].append(f"Audit System Failure: {str(e)}")
            
        return results
