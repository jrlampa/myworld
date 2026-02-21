"""
Testes unitários para utils/logger.py

Cobre: Logger.info, debug, error, success, geojson — e o flag SKIP_GEOJSON.
"""
import sys
import os
import json
import io

import pytest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.logger import Logger


def _capture_stdout(func, *args, **kwargs):
    """Captura stdout durante execução de func e retorna string."""
    buf = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = buf
    try:
        func(*args, **kwargs)
    finally:
        sys.stdout = old_stdout
    return buf.getvalue().strip()


class TestLogger:
    def test_info_outputs_json(self):
        output = _capture_stdout(Logger.info, "Iniciando processamento")
        data = json.loads(output)
        assert data["status"] == "progress"
        assert data["message"] == "Iniciando processamento"

    def test_info_with_progress(self):
        output = _capture_stdout(Logger.info, "Carregando OSM", progress=25)
        data = json.loads(output)
        assert data["progress"] == 25
        assert data["message"] == "Carregando OSM"

    def test_info_with_custom_status(self):
        output = _capture_stdout(Logger.info, "msg", status="custom")
        data = json.loads(output)
        assert data["status"] == "custom"

    def test_debug_outputs_json(self):
        output = _capture_stdout(Logger.debug, "Debug message")
        data = json.loads(output)
        assert data["status"] == "debug"
        assert data["message"] == "Debug message"

    def test_error_outputs_json(self):
        output = _capture_stdout(Logger.error, "Erro crítico")
        data = json.loads(output)
        assert data["status"] == "error"
        assert data["message"] == "Erro crítico"

    def test_success_outputs_json(self):
        output = _capture_stdout(Logger.success, "DXF gerado com sucesso")
        data = json.loads(output)
        assert data["status"] == "success"
        assert data["message"] == "DXF gerado com sucesso"

    def test_geojson_outputs_json(self):
        Logger.SKIP_GEOJSON = False
        geojson_data = {"type": "FeatureCollection", "features": []}
        output = _capture_stdout(Logger.geojson, geojson_data)
        data = json.loads(output)
        assert data["type"] == "geojson"
        assert data["data"] == geojson_data

    def test_geojson_skipped_when_flag_set(self):
        Logger.SKIP_GEOJSON = True
        output = _capture_stdout(Logger.geojson, {"type": "FeatureCollection", "features": []})
        assert output == ""
        # Restore
        Logger.SKIP_GEOJSON = False

    def test_geojson_custom_message(self):
        Logger.SKIP_GEOJSON = False
        output = _capture_stdout(Logger.geojson, {}, message="Atualizando mapa")
        data = json.loads(output)
        assert data["message"] == "Atualizando mapa"
