

import asyncio
import contextlib
import os
import sys
from unittest.mock import patch, MagicMock

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)


os.environ["DB_TYPE"] = "sqlite"
os.environ["AI_PREFLIGHT"] = "false"
os.environ.setdefault("DB_SQLITE_PATH", os.path.abspath(
    os.path.join(_AI_DIR, "..", "frontend", "public", "edumap.db")
))

import pytest

import services.climate_guardian as climate_guardian_module
from routers import geo, system
from services.llm_service import LLMService





def test_get_elevation_uses_defined_local_flag(monkeypatch, tmp_path):
    """``_get_elevation`` must not raise when the local SRTM model is absent.

    Before the fix this raised ``NameError: name '_get_elevation_local_enabled'
    is not defined`` and the router swallowed it into a degraded (empty)
    heatmap.
    """
    monkeypatch.setattr(climate_guardian_module, "ELEV_CACHE_PATH",
                        str(tmp_path / "elev_cache.json"))
    monkeypatch.setattr(climate_guardian_module, "LOCAL_ELEVATION_ENABLED", True)
    monkeypatch.setattr(climate_guardian_module, "_load_local_elevation",
                        lambda: False)
    monkeypatch.setattr(climate_guardian_module, "_curl_get_json",
                        lambda url, timeout=6: {"elevation": [12.5]})

    assert climate_guardian_module._get_elevation(10.95, 106.88) == 12.5


def test_get_elevation_skips_local_when_disabled(monkeypatch, tmp_path):
    """``LOCAL_ELEVATION_ENABLED=false`` must skip the local model entirely."""
    calls = {"local": 0}

    def _fake_local(lat, lng):
        calls["local"] += 1
        return 99.0

    monkeypatch.setattr(climate_guardian_module, "ELEV_CACHE_PATH",
                        str(tmp_path / "elev_cache.json"))
    monkeypatch.setattr(climate_guardian_module, "LOCAL_ELEVATION_ENABLED", False)
    monkeypatch.setattr(climate_guardian_module, "_get_elevation_local", _fake_local)
    monkeypatch.setattr(climate_guardian_module, "_curl_get_json",
                        lambda url, timeout=6: {"elevation": [3.0]})

    assert climate_guardian_module._get_elevation(10.95, 106.88) == 3.0
    assert calls["local"] == 0





def test_hf_vision_detect_requires_token(monkeypatch):
    """``_hf_vision_detect`` must exist and raise RuntimeError without a token."""
    monkeypatch.setattr(geo, "HF_TOKEN", "")
    monkeypatch.setattr(geo, "_geo_vision_down_until", 0.0)

    with pytest.raises(RuntimeError, match="HF_TOKEN"):
        geo._hf_vision_detect("ZmFrZQ==", ["school"])


def test_hf_vision_detect_respects_circuit_breaker(monkeypatch):
    """An open circuit breaker raises RuntimeError instead of calling HF."""
    monkeypatch.setattr(geo, "HF_TOKEN", "fake-token")
    monkeypatch.setattr(geo, "_geo_vision_down_until", 10 ** 12)

    with pytest.raises(RuntimeError, match="circuit breaker"):
        geo._hf_vision_detect("ZmFrZQ==", ["school"])





def test_system_status_resolves_check_oom():
    """The status endpoint must import ``check_oom`` (was a NameError → 500)."""
    status = asyncio.run(system.system_status())

    assert "ram" in status
    assert "oom_guard" in status
    assert status["oom_guard"]["enabled"] is True
    assert "providers" in status





def test_local_llm_generate_decodes_output(monkeypatch):
    """``_local_llm_generate`` must decode model output via ``tokenizer.decode``.

    Before the fix, the function body had ``text = generated.strip()`` without
    ever assigning ``generated`` — the ``decode`` call was lost when the code
    was refactored from TinyLlama to Gemma in commit ``0d12ee7``.  Every local
    LLM invocation raised ``NameError``, which the outer ``except`` turned into
    a ``RuntimeError`` + 5-minute circuit breaker, wasting ~1.5 GB of RAM
    holding a model that could never produce output.
    """
    import services.llm_service as llm_mod


    monkeypatch.setattr(llm_mod, "_local_llm_down_until", 0.0)
    monkeypatch.setattr(llm_mod, "_local_llm_loaded", True)
    monkeypatch.setattr(llm_mod, "_local_llm_load_failed", False)


    mock_tokenizer = MagicMock()
    mock_tokenizer.eos_token_id = 1
    mock_tokenizer.decode.return_value = "  Hello from Gemma  "


    mock_input_ids = MagicMock()
    mock_input_ids.shape = (1, 5)


    mock_inputs = MagicMock()
    mock_inputs.input_ids = mock_input_ids
    mock_tokenizer.return_value = mock_inputs


    mock_model = MagicMock()
    mock_output = MagicMock()
    mock_output.__getitem__ = MagicMock(return_value=MagicMock())
    mock_model.generate.return_value = mock_output

    monkeypatch.setattr(llm_mod, "_local_llm_model", mock_model)
    monkeypatch.setattr(llm_mod, "_local_llm_tokenizer", mock_tokenizer)

    _dummy_ctx = contextlib.nullcontext()
    monkeypatch.setattr(llm_mod, "_time_limit", lambda *a, **kw: _dummy_ctx)

    result = llm_mod._local_llm_generate("test prompt")


    mock_tokenizer.decode.assert_called_once()
    assert result == "Hello from Gemma"


def test_local_llm_generate_raises_on_empty_output(monkeypatch):
    """Empty decode output must raise RuntimeError (not NameError)."""
    import services.llm_service as llm_mod

    monkeypatch.setattr(llm_mod, "_local_llm_down_until", 0.0)
    monkeypatch.setattr(llm_mod, "_local_llm_loaded", True)
    monkeypatch.setattr(llm_mod, "_local_llm_load_failed", False)

    mock_tokenizer = MagicMock()
    mock_tokenizer.eos_token_id = 1
    mock_tokenizer.decode.return_value = ""

    mock_input_ids = MagicMock()
    mock_input_ids.shape = (1, 3)


    mock_inputs = MagicMock()
    mock_inputs.input_ids = mock_input_ids
    mock_tokenizer.return_value = mock_inputs

    mock_model = MagicMock()
    mock_output = MagicMock()
    mock_output.__getitem__ = MagicMock(return_value=MagicMock())
    mock_model.generate.return_value = mock_output

    monkeypatch.setattr(llm_mod, "_local_llm_model", mock_model)
    monkeypatch.setattr(llm_mod, "_local_llm_tokenizer", mock_tokenizer)
    monkeypatch.setattr(llm_mod, "_time_limit", lambda *a, **kw: contextlib.nullcontext())

    with pytest.raises(RuntimeError, match="empty response"):
        llm_mod._local_llm_generate("test prompt")


def test_recommend_career_semantic_prompt_builds_json_schema():
    """The enrichment prompt contains a literal JSON schema, not an f-string set.

    Before the fix the f-string evaluated ``{title, match_score, ...}`` as a
    Python set literal and raised ``NameError: name 'title' is not defined``
    before the ``try`` block, so the whole endpoint 500'd.
    """
    svc = LLMService()
    svc.is_ready = True
    semantic_results = [{
        "title": "Data Analyst",
        "match_score": 0.91,
        "explanation": "",
        "missing_skills": [],
        "radar_chart": {},
    }]
    captured = {}

    def _fake_generate(prompt, **kwargs):
        captured["prompt"] = prompt
        return "[]"

    async def _run():
        with patch("services.vector_store.vector_store") as mock_vs, \
             patch.object(svc, "_generate_text_with_fallback", side_effect=_fake_generate):
            mock_vs.semantic_career_search.return_value = semantic_results
            return await svc.recommend_career_semantic(["python"], ["data"])

    result = asyncio.run(_run())

    prompt = captured["prompt"]
    assert "{title, match_score" in prompt
    assert "radar_chart" in prompt

    assert result and result[0]["title"] == "Data Analyst"
