"""
dxf_aneel.py

Regras ANEEL/PRODIST para infraestrutura elétrica em plantas CAD.

Referências:
  - PRODIST Módulo 6 (Qualidade do Produto Elétrico) — classificação de tensão
  - PRODIST Módulo 3 (Acesso ao Sistema de Distribuição) — distâncias de segurança
  - ABNT NBR 5422 (Projeto de linhas aéreas de transmissão de energia elétrica)
  - ABNT NBR 14039 (Instalações elétricas de média tensão)

NOTA: Quando estas normas estiverem ativas, as convenções ABNT NBR 10582/8196
são SUBSTITUÍDAS pelas da concessionária para as camadas de infraestrutura elétrica.
O sistema exibirá um toast explícito informando esse comportamento ao usuário.
"""

# Tensões limites — PRODIST Módulo 6, Seção 1.2 (em Volts)
TENSAO_AT_MIN_V = 36_200   # Alta Tensão (AT): acima de 36,2 kV
TENSAO_MT_MIN_V = 1_000    # Média Tensão (MT): de 1 kV a 36,2 kV
# Abaixo de 1.000 V = Baixa Tensão (BT)

# Distâncias de segurança — PRODIST Módulo 3 / ABNT NBR 5422 (metros)
BUFFER_AT_M = 15.0   # Faixa de segurança para linhas de AT
BUFFER_MT_M = 8.0    # Faixa de segurança para linhas de MT
BUFFER_BT_M = 3.0    # Faixa de segurança para linhas de BT

# Nomes de Layers DXF — Nomenclatura ANEEL/PRODIST
LAYER_AT = 'REDE_AT'         # Alta Tensão (> 36,2 kV)
LAYER_MT = 'REDE_MT'         # Média Tensão (1 kV – 36,2 kV)
LAYER_BT = 'REDE_BT'         # Baixa Tensão (< 1 kV)
LAYER_SE = 'SUBESTACAO'      # Subestação de energia
LAYER_TRANSF = 'TRANSFORMADOR'  # Transformador de distribuição

# Definições de layers ANEEL: (nome, cor AutoCAD, espessura mm, linetype)
ANEEL_LAYER_DEFS = [
    (LAYER_AT,    1,  0.50, 'DASHED'),     # Vermelho, tracejado — AT
    (LAYER_MT,    4,  0.35, 'HIDDEN'),     # Ciano, oculto — MT
    (LAYER_BT,    2,  0.20, 'Continuous'), # Amarelo, contínuo — BT
    (LAYER_SE,    6,  0.35, 'Continuous'), # Magenta — Subestação
    (LAYER_TRANSF, 3, 0.25, 'Continuous'), # Verde — Transformador
]


def classify_voltage(voltage_str: str) -> str:
    """Classifica a tensão elétrica conforme PRODIST Módulo 6, Seção 1.2.

    Args:
        voltage_str: String de tensão OSM (ex: '138000', '13800', '220').
                     Suporta múltiplos valores separados por ';'.

    Returns:
        'AT' para Alta Tensão, 'MT' para Média Tensão, 'BT' para Baixa Tensão.
    """
    if not voltage_str or not str(voltage_str).strip():
        return 'MT'  # Padrão conservador: média tensão quando indefinido
    try:
        tensoes = [v.strip() for v in str(voltage_str).split(';') if v.strip()]
        if not tensoes:
            return 'MT'
        max_v = max(float(v) for v in tensoes)
        if max_v >= TENSAO_AT_MIN_V:
            return 'AT'
        if max_v >= TENSAO_MT_MIN_V:
            return 'MT'
        return 'BT'
    except (ValueError, TypeError):
        return 'MT'  # Fallback conservador para valores inválidos


def get_aneel_layer(tags: dict) -> str:
    """Determina o layer ANEEL/PRODIST baseado nas tags OSM.

    Args:
        tags: Dicionário ou Series de tags OSM do elemento power.

    Returns:
        Nome do layer DXF conforme nomenclatura ANEEL/PRODIST.
    """
    power_tag = tags.get('power', '')
    if not isinstance(power_tag, str):
        power_tag = str(power_tag) if power_tag else ''

    if power_tag == 'substation':
        return LAYER_SE
    if power_tag == 'transformer':
        return LAYER_TRANSF
    if power_tag in ('minor_line', 'cable'):
        return LAYER_BT

    # Classificação por tensão para linhas, torres e postes
    voltage = tags.get('voltage', '')
    if not isinstance(voltage, str):
        voltage = str(voltage) if voltage else ''

    nivel = classify_voltage(voltage)
    if nivel == 'AT':
        return LAYER_AT
    if nivel == 'MT':
        return LAYER_MT
    return LAYER_BT


def get_aneel_buffer(layer: str) -> float:
    """Retorna o buffer de segurança PRODIST Módulo 3 para o layer elétrico.

    Args:
        layer: Nome do layer ANEEL (REDE_AT, REDE_MT, REDE_BT).

    Returns:
        Distância de segurança em metros conforme PRODIST.
    """
    if layer == LAYER_AT:
        return BUFFER_AT_M
    if layer == LAYER_MT:
        return BUFFER_MT_M
    return BUFFER_BT_M


def setup_aneel_layers(doc) -> None:
    """Configura os layers ANEEL/PRODIST no documento DXF.

    Deve ser chamado após DXFStyleManager.setup_layers() para que os linetypes
    padrão (DASHED, HIDDEN) já existam no documento antes de serem referenciados.
    Quando ativo, as normas da concessionária substituem as convenções
    ABNT NBR 8196/10582 para camadas de infraestrutura elétrica.

    Args:
        doc: Documento ezdxf onde os layers serão criados.
    """
    try:
        from dxf_styles import _map_cad_lineweight
    except (ImportError, ValueError):  # pragma: no cover
        from .dxf_styles import _map_cad_lineweight

    for name, color, lineweight_mm, linetype in ANEEL_LAYER_DEFS:
        if name not in doc.layers:
            doc.layers.new(name, dxfattribs={
                'color': color,
                'lineweight': _map_cad_lineweight(lineweight_mm),
                'linetype': linetype,
            })
