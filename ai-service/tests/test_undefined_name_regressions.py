

import asyncio
import os
import sys
from unittest.mock import patch

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





def test_get_elevation_uses_open_meteo_api(monkeypatch, tmp_path):
    """``_get_elevation`` must fetch from Open-Meteo — no local SRTM model exists.

    Before the fix this raised ``NameError: name '_get_elevation_local_enabled'
    is not defined`` and the router swallowed it into a degraded (empty)
    heatmap.
    """
    monkeypatch.setattr(climate_guardian_module, "ELEV_CACHE_PATH",
                        str(tmp_path / "elev_cache.json"))
    monkeypatch.setattr(climate_guardian_module, "_curl_get_json",
                        lambda url, timeout=6: {"elevation": [12.5]})

    # No leftover local-elevation names may be referenced anywhere.
    assert not hasattr(climate_guardian_module, "LOCAL_ELEVATION_ENABLED")
    assert not hasattr(climate_guardian_module, "_get_elevation_local")
    assert not hasattr(climate_guardian_module, "_load_local_elevation")

    assert climate_guardian_module._get_elevation(10.95, 106.88) == 12.5


def test_get_elevation_reuses_disk_cache(monkeypatch, tmp_path):
    """``_get_elevation`` must cache to disk and avoid repeated API calls."""
    calls = [0]

    def _fake_curl(url, timeout=6):
        calls[0] += 1
        return {"elevation": [3.0]}

    monkeypatch.setattr(climate_guardian_module, "ELEV_CACHE_PATH",
                        str(tmp_path / "elev_cache.json"))
    monkeypatch.setattr(climate_guardian_module, "_curl_get_json", _fake_curl)

    assert climate_guardian_module._get_elevation(10.95, 106.88) == 3.0
    assert calls[0] == 1
    assert climate_guardian_module._get_elevation(10.95, 106.88) == 3.0
    assert calls[0] == 1





def test_hf_vision_detect_removed(monkeypatch):
    """``_hf_vision_detect`` no longer exists (the vision provider was removed)."""
    assert not hasattr(geo, "_hf_vision_detect")


def test_green_vision_degrades_cleanly():
    """``vision_detect`` never 502s — returns degraded empty detections."""
    from fastapi.testclient import TestClient  # noqa: PLC0415

    from main import app

    client = TestClient(app)
    res = client.post("/api/ai/geo/vision-detect", json={"image_base64": "ZmFrZQ=="})
    assert res.status_code == 200
    body = res.json()
    assert body["degraded"] is True
    assert body["detections"] == []





def test_system_status_resolves_check_oom():
    """The status endpoint must import ``check_oom`` (was a NameError → 500)."""
    status = asyncio.run(system.system_status())

    assert "ram" in status
    assert "oom_guard" in status
    assert status["oom_guard"]["enabled"] is True
    assert "providers" in status





def test_llm_chain_has_no_local_model(monkeypatch):
    """``_generate_text_with_fallback`` must not reference any local model.

    `_local_llm_generate`, `_load_local_llm` and `_time_limit` were removed:
    the chain is DeepSeek → Google Gemini → Cloudflare Workers AI → template.
    When no provider is configured, it must raise RuntimeError so callers
    (chat, LLMBridge) degrade to a template reply instead of 502ing.
    """
    import services.llm_service as llm_mod

    # Ensure no external provider is configured while the test module is
    # imported (process-wide os.environ cannot be blanked here without
    # breaking other test modules — see test_deepseek_provider.py).
    monkeypatch.setenv("DEEPSEEK_API_KEY", "")
    monkeypatch.setenv("DEEPSEEK_BASE_URL", "")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "")
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "")

    for name in ("_local_llm_generate", "_load_local_llm", "_time_limit",
                 "has_local_llm"):
        assert not hasattr(llm_mod, name), f"{name} still exists in llm_service"

    svc = LLMService()
    assert not svc.has_deepseek and not svc.has_gemini and not svc.has_cf

    with pytest.raises(RuntimeError, match="Không thể sinh nội dung"):
        svc._generate_text_with_fallback("test prompt")

    print("✓ test_llm_chain_has_no_local_model")


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
