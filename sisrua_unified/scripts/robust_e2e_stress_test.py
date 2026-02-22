#!/usr/bin/env python3
"""
sisRUA — Stress Test E2E para geração de DXF em áreas urbanas.

Cenários de teste:
  1. Canônico (Muriaé/MG) — raio 100m, 500m e 1km
     UTM 23K 788547 7634925 → lat=-22.15018, lon=-42.92185
  2. Centro de São Paulo — raio 500m (área urbana densa)
     lat=-23.5505, lon=-46.6333

Uso:
  python scripts/robust_e2e_stress_test.py

Requisitos:
  - Python engine em py_engine/main.py (Docker-first, sem .exe)
  - ezdxf instalado (pip install ezdxf)
  - Variável PYTHON_COMMAND (padrão: python3)
"""

import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

# ─── caminhos ────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent
MAIN_PY = ROOT / "py_engine" / "main.py"
PYTHON = os.environ.get("PYTHON_COMMAND", "python3")

# ─── cenários de teste ────────────────────────────────────────────────────────

SCENARIOS = [
    # Coordenadas canônicas (Muriaé/MG) — 23K 788547 7634925
    {"label": "canonical_100m",  "lat": -22.15018, "lon": -42.92185, "radius": 100},
    {"label": "canonical_500m",  "lat": -22.15018, "lon": -42.92185, "radius": 500},
    {"label": "canonical_1000m", "lat": -22.15018, "lon": -42.92185, "radius": 1000},
    # Área urbana densa — Centro de São Paulo
    {"label": "sp_centro_500m",  "lat": -23.5505,  "lon": -46.6333,  "radius": 500},
]


# ─── helpers ─────────────────────────────────────────────────────────────────

def _parse_timings(stdout: str) -> dict:
    """Extract Logger.timed() entries from structured JSON output."""
    timings = {}
    for line in stdout.splitlines():
        try:
            d = json.loads(line)
            if d.get("status") == "timing":
                timings[d["label"]] = d["duration_s"]
        except (json.JSONDecodeError, KeyError):
            pass
    return timings


def _headless_dxf_audit(dxf_path: Path) -> tuple[str, int]:
    """Audit a DXF file via ezdxf. Returns (status, error_count).

    ezdxf is a required project dependency (see py_engine/requirements.txt).
    A missing import is treated as a fatal misconfiguration in this stress test.
    """
    try:
        import ezdxf  # noqa: PLC0415 — local import intentional
    except ImportError:
        print("ERRO FATAL: ezdxf não instalado. Execute: pip install ezdxf", file=sys.stderr)
        sys.exit(2)
    try:
        doc = ezdxf.readfile(str(dxf_path))
        auditor = doc.audit()
        errors = len(auditor.errors)
        status = "PASS" if errors == 0 else f"AUDIT_WARN({errors} errors)"
        return status, errors
    except Exception as exc:
        return f"AUDIT_ERROR: {exc}", -1


def run_scenario(scenario: dict, output_dir: Path) -> dict:
    """Run one DXF generation scenario; return a result dict."""
    label = scenario["label"]
    output_path = output_dir / f"stress_{label}.dxf"

    cmd = [
        PYTHON, str(MAIN_PY),
        "--lat",    str(scenario["lat"]),
        "--lon",    str(scenario["lon"]),
        "--radius", str(scenario["radius"]),
        "--output", str(output_path),
        "--layers", '{"buildings":true,"roads":true,"nature":true}',
        "--no-preview",
    ]

    print(f"\n{'─'*60}")
    print(f"Cenário : {label}")
    print(f"Coords  : lat={scenario['lat']}, lon={scenario['lon']}, raio={scenario['radius']}m")
    print(f"Saída   : {output_path.name}")

    t0 = time.time()
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    elapsed = time.time() - t0

    timings = _parse_timings(result.stdout)

    print(f"Código  : {result.returncode}  |  Tempo total: {elapsed:.2f}s")
    if timings:
        for k, v in timings.items():
            print(f"  [{k}]: {v:.3f}s")

    if result.returncode != 0:
        # Show last 20 lines of stderr for diagnostics (line-safe truncation)
        stderr_lines = result.stderr.splitlines()
        stderr_tail = "\n".join(stderr_lines[-20:])
        print(f"FALHA — stderr (últimas {min(20, len(stderr_lines))} linhas):\n{stderr_tail}")
        return {"label": label, "status": "FAIL", "elapsed_s": elapsed, "timings": timings}

    # Headless DXF audit via ezdxf
    audit_status, _ = _headless_dxf_audit(output_path)
    print(f"Auditoria DXF: {audit_status}")
    return {"label": label, "status": audit_status, "elapsed_s": elapsed, "timings": timings}


# ─── entry point ─────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  sisRUA — Stress Test E2E  (Docker-first, sem .exe)")
    print("=" * 60)
    print(f"Engine  : {MAIN_PY}")
    print(f"Python  : {PYTHON}")
    print(f"Cenários: {len(SCENARIOS)}")

    if not MAIN_PY.exists():
        print(f"\nERRO: Engine não encontrado em {MAIN_PY}", file=sys.stderr)
        sys.exit(1)

    with tempfile.TemporaryDirectory(prefix="sisrua_stress_") as tmpdir:
        output_dir = Path(tmpdir)
        results = []
        for scenario in SCENARIOS:
            try:
                res = run_scenario(scenario, output_dir)
            except subprocess.TimeoutExpired:
                res = {"label": scenario["label"], "status": "TIMEOUT", "elapsed_s": 300.0, "timings": {}}
                print(f"TIMEOUT: {scenario['label']} excedeu 300s")
            results.append(res)

    # ─── resumo ──────────────────────────────────────────────────────────────
    print(f"\n{'=' * 60}")
    print("  RESUMO")
    print(f"{'=' * 60}")
    failed = []
    for r in results:
        if r["status"] == "PASS":
            icon = "✅"
        elif r["status"].startswith("AUDIT_WARN") or r["status"].startswith("SKIP"):
            icon = "⚠️"
        else:
            icon = "❌"
            failed.append(r["label"])
        print(f"{icon}  {r['label']:<30} {r['status']}  ({r['elapsed_s']:.2f}s)")

    if failed:
        print(f"\n❌ Falhas: {', '.join(failed)}")
        sys.exit(1)

    print("\n✅ Todos os cenários passaram!")


if __name__ == "__main__":
    main()
