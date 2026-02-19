from pathlib import Path

from py_engine.main import _quality_to_samples, generate_dxf_from_coordinates


def test_quality_mode_sample_mapping():
    assert _quality_to_samples("balanced") == 8
    assert _quality_to_samples("high") == 16
    assert _quality_to_samples("ultra") == 32


def test_generate_dxf_returns_metadata_and_stats(tmp_path: Path):
    output = tmp_path / "engine_precision_test.dxf"

    result = generate_dxf_from_coordinates(
        lat=-22.324554,
        lng=-41.753739,
        radius=80,
        output_filename=str(output),
        quality_mode="balanced",
        strict_mode=False,
    )

    assert result["success"] is True
    assert output.exists()
    assert result["metadata"]["quality_mode"] == "balanced"
    assert "providers_used" in result["metadata"]
    assert result["stats"]["sample_count"] >= 9
