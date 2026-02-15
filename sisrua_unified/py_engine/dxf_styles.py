import ezdxf
from ezdxf.enums import TextEntityAlignment

class DXFStyleManager:
    """Manages CAD layers, blocks, and styles to decouple logic from DXFGenerator."""
    
    @staticmethod
    def setup_all(doc):
        """Initialize all document styles and standards."""
        DXFStyleManager.setup_linetypes(doc)
        DXFStyleManager.setup_text_styles(doc)
        DXFStyleManager.setup_layers(doc)
        DXFStyleManager.setup_blocks(doc)
        DXFStyleManager.setup_logo(doc)

    @staticmethod
    def setup_linetypes(doc):
        """Define professional CAD linetypes."""
        if 'DASHED' not in doc.linetypes:
            doc.linetypes.new('DASHED', dxfattribs={'description': 'Dashed', 'pattern': [1.0, -0.5]})
        if 'HIDDEN' not in doc.linetypes:
            doc.linetypes.new('HIDDEN', dxfattribs={'description': 'Hidden', 'pattern': [0.5, -0.25]})

    @staticmethod
    def setup_text_styles(doc):
        """Setup professional typography."""
        if 'PRO_STYLE' not in doc.styles:
            doc.styles.new('PRO_STYLE', dxfattribs={'font': 'arial.ttf'})

    @staticmethod
    def setup_layers(doc):
        """Define standard engineering layers."""
        layers = [
            ('EDIFICACAO', 7, 0.30),    # White/Black
            ('VIAS', 8, 0.15),          # Gray
            ('VIAS_MEIO_FIO', 251, 0.15),
            ('VEGETACAO', 3, 0.11),      # Green (finer)
            ('MOBILIARIO_URBANO', 40, 0.15), # Orange/Brown
            ('EQUIPAMENTOS', 4, 0.15),   # Cyan
            ('INFRA_POWER_HV', 1, 0.30), # Red
            ('INFRA_POWER_LV', 30, 0.20),# Orange
            ('INFRA_TELECOM', 94, 0.15), # Green-ish
            ('TOPOGRAFIA_CURVAS', 252, 0.13),
            ('MALHA_COORD', 253, 0.05),
            ('ANNOT_AREA', 2, 0.13),     # Yellow
            ('ANNOT_LENGTH', 2, 0.13),
            ('LEGENDA', 7, 0.15),
            ('TEXTO', 7, 0.15),
            ('CURVAS_NIVEL_MESTRA', 251, 0.25),
            ('CURVAS_NIVEL_INTERM', 252, 0.13),
        ]
        
        for name, color, lineweight in layers:
            if name not in doc.layers:
                doc.layers.new(name, dxfattribs={
                    'color': color,
                    'lineweight': int(lineweight * 100)
                })

    @staticmethod
    def setup_blocks(doc):
        """Define standard engineering blocks/symbols."""
        # ARVORE (Tree)
        if 'ARVORE' not in doc.blocks:
            blk = doc.blocks.new(name='ARVORE')
            blk.add_circle((0, 0), radius=2, dxfattribs={'layer': 'VEGETACAO', 'color': 3})
            blk.add_line((-1.5, 0), (1.5, 0), dxfattribs={'layer': 'VEGETACAO'})
            blk.add_line((0, -1.5), (0, 1.5), dxfattribs={'layer': 'VEGETACAO'})

        # POSTE (Utility Pole)
        if 'POSTE' not in doc.blocks:
            blk = doc.blocks.new(name='POSTE')
            blk.add_circle((0, 0), radius=0.4, dxfattribs={'color': 7})
            blk.add_line((-0.3, -0.3), (0.3, 0.3))
            blk.add_line((-0.3, 0.3), (0.3, -0.3))
            blk.add_attdef('ID', (0.5, 0.5), dxfattribs={'height': 0.3, 'color': 2})
            blk.add_attdef('TYPE', (0.5, 0.1), dxfattribs={'height': 0.2, 'color': 8})
            blk.add_attdef('V_LEVEL', (0.5, -0.3), dxfattribs={'height': 0.2, 'color': 1})

        # BANCO (Bench)
        if 'BANCO' not in doc.blocks:
            blk = doc.blocks.new(name='BANCO')
            blk.add_lwpolyline([( -0.8, -0.4), (0.8, -0.4), (0.8, 0.4), (-0.8, 0.4)], close=True)
            blk.add_line((-0.8, 0), (0.8, 0))

        # LIXEIRA (Waste Basket)
        if 'LIXEIRA' not in doc.blocks:
            blk = doc.blocks.new(name='LIXEIRA')
            blk.add_circle((0, 0), radius=0.3)
            blk.add_circle((0, 0), radius=0.1)

        # POSTE_LUZ (Street Lamp)
        if 'POSTE_LUZ' not in doc.blocks:
            blk = doc.blocks.new(name='POSTE_LUZ')
            blk.add_circle((0, 0), radius=0.2, dxfattribs={'color': 2}) # Yellow bulb
            blk.add_circle((0, 0), radius=0.4)

        # TORRE (Power Tower)
        if 'TORRE' not in doc.blocks:
            blk = doc.blocks.new(name='TORRE')
            blk.add_lwpolyline([(-1, -1), (1, -1), (1, 1), (-1, 1)], close=True)
            blk.add_line((-1, -1), (1, 1))
            blk.add_line((-1, 1), (1, -1))
            blk.add_attdef('ID', (1.2, 1.2), dxfattribs={'height': 0.5, 'color': 2})

        # NORTH ARROW
        if 'NORTE' not in doc.blocks:
            blk = doc.blocks.new(name='NORTE')
            blk.add_lwpolyline([(0, 0), (-1, -3), (0, 1), (1, -3)], close=True, dxfattribs={'color': 7})
            blk.add_text("N", dxfattribs={'height': 1.5, 'color': 7}).set_placement((0, 1.5), align=TextEntityAlignment.CENTER)

        # SCALE BAR
        if 'ESCALA' not in doc.blocks:
            blk = doc.blocks.new(name='ESCALA')
            blk.add_lwpolyline([(0, 0), (10, 0), (10, 1), (0, 1)], close=True)
            blk.add_line((5, 0), (5, 1))
            blk.add_text("0", dxfattribs={'height': 1}).set_placement((0, -1.5), align=TextEntityAlignment.CENTER)
            blk.add_text("5m", dxfattribs={'height': 1}).set_placement((5, -1.5), align=TextEntityAlignment.CENTER)
            blk.add_text("10m", dxfattribs={'height': 1}).set_placement((10, -1.5), align=TextEntityAlignment.CENTER)

    @staticmethod
    def setup_logo(doc):
        """Unified system logo block."""
        if 'LOGO' not in doc.blocks:
            blk = doc.blocks.new(name='LOGO')
            blk.add_lwpolyline([(0, 5), (5, 0), (0, -5), (-5, 0)], close=True, dxfattribs={'color': 7})
            blk.add_circle((0, 0), radius=1, dxfattribs={'color': 2})
            blk.add_text("RUAS", dxfattribs={'height': 1.5, 'color': 7}).set_placement((0, -7), align=TextEntityAlignment.CENTER)

    @staticmethod
    def get_street_width(highway_tag):
        """Returns the authoritative half-width for a given highway type."""
        # Cleaned up and centralized for geometric accuracy
        widths = {
            'motorway': 12.0,
            'trunk': 10.0,
            'primary': 8.0,
            'secondary': 7.0,
            'tertiary': 6.0,
            'residential': 5.0,
            'service': 3.5,
            'living_street': 3.0,
            'pedestrian': 4.0,
            'track': 3.0
        }
        return widths.get(highway_tag, 5.0)
