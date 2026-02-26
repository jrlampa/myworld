import ezdxf
from utils.logger import Logger

class BIMDataEmbedder:
    APP_ID = "SISRUA_BIM"

    @classmethod
    def setup(cls, doc):
        """Register the APPID for XDATA if not already registered."""
        if cls.APP_ID not in doc.appids:
            doc.appids.new(cls.APP_ID)

    @classmethod
    def embed_xdata(cls, entity, tags, layer):
        """
        Embed Half-way BIM data as XDATA into the DXF entity.
        Requires the DXF entity and the OSM tags dictionary.
        """
        try:
            # Prepare metadata mapping
            bim_metadata = {
                "source": "OSM",
                "layer_type": layer
            }
            
            # Common tags to include if present
            keys_to_extract = ["name", "highway", "building", "power", "amenity", "height", "ele", "levels", "voltage"]
            for k in keys_to_extract:
                if k in tags and str(tags[k]).lower() != "nan":
                    bim_metadata[k] = str(tags[k])
                    
            # In ezdxf, XDATA is added as a list of tuples (group_code, value)
            # 1000 = String, 1040 = Float, 1070 = Integer
            xdata_tags = []
            for k, v in bim_metadata.items():
                # We format it as "key:value" strings for simplicity and universal reading
                xdata_tags.append((1000, f"{k}:{v}"))
                
            entity.set_xdata(cls.APP_ID, xdata_tags)
        except Exception as e:
            Logger.info(f"Failed to embed BIM XDATA: {e}")
