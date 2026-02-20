import json
from typing import Dict, Any

# Função para aplicar template de estilos CAD ao gerar DXF
# O template é um dicionário JSON com nomes de layers, cores, espessuras etc.
def apply_cad_template(dxf_data: Dict[str, Any], template: Dict[str, Any]) -> Dict[str, Any]:
    # Exemplo: sobrescreve propriedades de layers
    for layer in dxf_data.get("layers", []):
        name = layer.get("name")
        if name in template.get("layers", {}):
            layer.update(template["layers"][name])
    # Outras customizações podem ser aplicadas conforme template
    return dxf_data

# Exemplo de uso:
# with open("template.json") as f:
#     template = json.load(f)
# dxf_data = ... # dicionário representando o DXF
# dxf_data_custom = apply_cad_template(dxf_data, template)
