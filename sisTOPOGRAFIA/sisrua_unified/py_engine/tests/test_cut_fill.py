import json
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from domain.services.cut_fill_optimizer import CutFillOptimizer

def test_cut_fill():
    print("--- Testing CutFillOptimizer ---")
    
    # 1. Standard Point (Lat/Lon)
    polygon_ll = [
        {"lat": -22.15018, "lng": -42.92185},
        {"lat": -22.15028, "lng": -42.92185},
        {"lat": -22.15028, "lng": -42.92195},
        {"lat": -22.15018, "lng": -42.92195},
        {"lat": -22.15018, "lng": -42.92185}
    ]
    
    target_z = 700.0
    optimizer_ll = CutFillOptimizer(polygon_ll, target_z, auto_balance=False)
    
    try:
        print("[TEST 1] Fixed Z Calculation")
        result = optimizer_ll.calculate()
        assert 'cut_volume' in result and 'fill_volume' in result
        print("Fixed Z: OK\n")

        print("[TEST 2] Auto Balance (Net Volume ~ 0)")
        # Testando Otimização
        optimizer_auto = CutFillOptimizer(polygon_ll, auto_balance=True)
        res_auto = optimizer_auto.calculate()
        
        net_vol = res_auto['net_volume']
        opt_z = res_auto['stats']['target_z']
        
        print(f"Balanço Z Encontrado: {opt_z:.2f} m")
        print(f"Net Volume Resultante: {net_vol:.4f} m³")
        
        if abs(net_vol) > 1.0:
            print(f"FAILED: Net Volume {net_vol} is > 1.0 m³")
            return False
            
        print("Auto Balance: OK\n")
        
        # O teste com coordenada UTM puramente textual (ex: "23K 788547 7634925") ocorre no endpoint.
        # Mas podemos forçar o UTM -> LatLon conversion se necessário usando os serviços já construídos, 
        # porém o CutFillOptimizer aceita lat/lon diretamente.

        print("All CutFillOptimizer Tests: OK")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    if test_cut_fill():
        sys.exit(0)
    else:
        sys.exit(1)
