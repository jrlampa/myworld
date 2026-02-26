import ezdxf
from ezdxf.enums import TextEntityAlignment

class DXFStyleManager:
    """Manages CAD layers, blocks, and styles to decouple logic from DXFGenerator."""
    
    @staticmethod
    def setup_all(doc):
        DXFStyleManager.setup_linetypes(doc)
        DXFStyleManager.setup_text_styles(doc)
        DXFStyleManager.setup_layers(doc)
        DXFStyleManager.setup_blocks(doc)
        DXFStyleManager.setup_logo(doc)

    @staticmethod
    def setup_linetypes(doc):
        if 'DASHED' not in doc.linetypes:
            doc.linetypes.new('DASHED', dxfattribs={'description': 'Dashed', 'pattern': [1.0, -0.5]})
        if 'HIDDEN' not in doc.linetypes:
            doc.linetypes.new('HIDDEN', dxfattribs={'description': 'Hidden', 'pattern': [0.5, -0.25]})

    @staticmethod
    def setup_text_styles(doc):
        if 'PRO_STYLE' not in doc.styles:
            doc.styles.new('PRO_STYLE', dxfattribs={'font': 'arial.ttf'})

    @staticmethod
    def setup_layers(doc):
        """Define standard engineering layers with sisTOPO_ prefix."""
        layers = [
            ('sisTOPO_EDIFICACAO', 7, 0.30),
            ('sisTOPO_VIAS', 8, 0.15),
            ('sisTOPO_VIAS_MEIO_FIO', 251, 0.09),
            ('sisTOPO_VEGETACAO', 3, 0.13),
            ('sisTOPO_MOBILIARIO_URBANO', 40, 0.15),
            ('sisTOPO_EQUIPAMENTOS', 4, 0.15),
            ('sisTOPO_INFRA_POWER_HV', 1, 0.35),
            ('sisTOPO_INFRA_POWER_LV', 30, 0.20),
            ('sisTOPO_INFRA_TELECOM', 94, 0.15),
            ('sisTOPO_HIDROGRAFIA', 5, 0.15),
            ('sisTOPO_HIDROGRAFIA_DRENAGEM', 4, 0.25),
            ('sisTOPO_PRODIST_FAIXA_HV', 1, 0.50),
            ('sisTOPO_PRODIST_FAIXA_MT', 30, 0.35),
            ('sisTOPO_PRODIST_FAIXA_BT', 40, 0.20),
            ('sisTOPO_TOPOGRAFIA_CURVAS', 252, 0.09),
            ('sisTOPO_MALHA_COORD', 253, 0.05),
            ('sisTOPO_ANNOT_AREA', 2, 0.13),
            ('sisTOPO_ANNOT_LENGTH', 2, 0.13),
            ('sisTOPO_TEXTO', 7, 0.15),
            ('sisTOPO_QUADRO', 7, 0.50),
        ]
        
        def map_weight(w):
            val = int(w * 100)
            for standard in [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50]:
                if val <= standard: return standard
            return 53

        for name, color, lineweight in layers:
            if name not in doc.layers:
                doc.layers.new(name, dxfattribs={
                    'color': color,
                    'lineweight': map_weight(lineweight)
                })

    @staticmethod
    def setup_blocks(doc):
        # 2.5D Block Definitions
        if 'ARVORE' not in doc.blocks:
            blk = doc.blocks.new(name='ARVORE')
            blk.add_circle((0, 0), radius=2, dxfattribs={'layer': 'sisTOPO_VEGETACAO', 'color': 3})
            blk.add_line((-1.5, 0), (1.5, 0), dxfattribs={'layer': 'sisTOPO_VEGETACAO'})
            blk.add_line((0, -1.5), (0, 1.5), dxfattribs={'layer': 'sisTOPO_VEGETACAO'})

        if 'POSTE' not in doc.blocks:
            blk = doc.blocks.new(name='POSTE')
            blk.add_circle((0, 0), radius=0.4, dxfattribs={'color': 7})
            blk.add_line((-0.3, -0.3), (0.3, 0.3))
            blk.add_line((-0.3, 0.3), (0.3, -0.3))
            blk.add_attdef('ID', (0.5, 0.5), dxfattribs={'height': 0.3, 'color': 2})

        if 'BANCO' not in doc.blocks:
            blk = doc.blocks.new(name='BANCO')
            blk.add_lwpolyline([( -0.8, -0.4), (0.8, -0.4), (0.8, 0.4), (-0.8, 0.4)], close=True)

        if 'POSTE_LUZ' not in doc.blocks:
            blk = doc.blocks.new(name='POSTE_LUZ')
            blk.add_circle((0, 0), radius=0.2, dxfattribs={'color': 2})
            blk.add_circle((0, 0), radius=0.4)

        if 'NORTE' not in doc.blocks:
            blk = doc.blocks.new(name='NORTE')
            blk.add_lwpolyline([(0, 0), (-1, -3), (0, 1), (1, -3)], close=True, dxfattribs={'color': 7})
            blk.add_text("N", dxfattribs={'height': 1.5}).set_placement((0, 1.5), align=TextEntityAlignment.CENTER)

        if 'ESCALA' not in doc.blocks:
            blk = doc.blocks.new(name='ESCALA')
            blk.add_lwpolyline([(0, 0), (10, 0), (10, 1), (0, 1)], close=True)

    @staticmethod
    def setup_logo(doc):
        if 'LOGO' not in doc.blocks:
            blk = doc.blocks.new(name='LOGO')
            blk.add_text("SISRUA", dxfattribs={'height': 1.5, 'color': 7}).set_placement((0, 0), align=TextEntityAlignment.CENTER)

    @staticmethod
    def get_street_width(highway_tag):
        widths = {
            'motorway': 10.0,
            'trunk': 9.0,
            'primary': 7.0,
            'secondary': 6.0,
            'tertiary': 5.0,
            'residential': 4.0,
            'service': 3.0,
            'living_street': 3.0,
            'pedestrian': 3.0,
            'track': 3.0
        }
        return widths.get(highway_tag, 5.0)
