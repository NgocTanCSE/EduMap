

import asyncio
import os
import sys
import time
from unittest.mock import patch, MagicMock


_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)




for _v in [
    "GEMINI_API_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID",
    ,
]:
    os.environ[_v] = ""
os.environ["AI_PREFLIGHT"] = "false"

from services.llm_service import LLMService


def _fresh_service():
    """Return a brand-new LLMService with all providers disabled."""
    return LLMService()


def test_moderate_text_returns_safe_fallback_when_no_providers():
    """When is_ready is False (no providers at all), moderate_text must NOT
    raise — it should return is_safe=True with low confidence so the regex
    Layer-1 pre-filter is the final gate."""
    svc = _fresh_service()
    assert svc.is_ready is False, "Expected is_ready=False with no providers"

    result = asyncio.run(svc.moderate_text("Bài viết kiểm tra an toàn"))
    assert result["is_safe"] is True
    assert result["confidence"] == 0.3
    assert result["flags"] == []
    assert "reason" in result
    assert "unavailable" in result["reason"].lower() or "regex" in result["reason"].lower()
    print("✓ test_moderate_text_returns_safe_fallback_when_no_providers")


def test_moderate_text_fallback_after_provider_failure():
    """Even when is_ready is True but every provider fails, moderate_text
    should return a safe fallback instead of raising."""
    svc = _fresh_service()

    svc.has_cf = True
    svc.is_ready = True
    svc.api_token = "fake-token"
    svc.account_id = "fake-account"




    result = asyncio.run(svc.moderate_text("Nội dung cần kiểm duyệt"))
    assert result["is_safe"] is True
    assert result["confidence"] == 0.3
    assert "reason" in result
    print("✓ test_moderate_text_fallback_after_provider_failure")


def test_cf_circuit_breaker_message_not_misleading():
    """When the CF circuit breaker is active, the error message should
    indicate 'temporarily unavailable' rather than 'not configured'."""
    svc = _fresh_service()
    svc.has_cf = True
    svc.is_ready = True
    svc.api_token = "fake-token"
    svc.account_id = "fake-account"

    svc._cf_down_until = time.monotonic() + 60

    err = None
    try:
        svc._cloudflare_generate("test prompt", max_tokens=10)
    except RuntimeError as e:
        err = str(e)

    assert err is not None, "Expected RuntimeError from _cloudflare_generate"


    cf_part = err.split("Cloudflare:")[1].split(",")[0] if "Cloudflare:" in err else ""
    assert "kho" + chr(0x3001) not in cf_part, f"CF should not say 'not configured' when circuit-broken: {cf_part}"


    err_lower = err.lower()
    assert "circuit" in err_lower or "gioi" in err_lower or "tam thoi" in err_lower or "cooldown" in err_lower, \
        f"Expected circuit-breaker indicator in error, got: {err}"
    print("✓ test_cf_circuit_breaker_message_not_misleading")


def test_generate_text_with_fallback_error_message():
    """When all providers fail, _generate_text_with_fallback should raise
    with a detailed per-provider breakdown."""
    svc = _fresh_service()
    svc.has_cf = True
    svc.api_token = "fake-token"
    svc.account_id = "fake-account"

    err = None
    try:
        svc._generate_text_with_fallback("test", max_tokens=10)
    except RuntimeError as e:
        err = str(e)

    assert err is not None
    assert "Không thể sinh nội dung" in err

    assert "Cloudflare:" in err

    assert "Gemini" in err
    print("✓ test_generate_text_with_fallback_error_message")


if __name__ == "__main__":
    test_moderate_text_returns_safe_fallback_when_no_providers()
    test_moderate_text_fallback_after_provider_failure()
    test_cf_circuit_breaker_message_not_misleading()
    test_generate_text_with_fallback_error_message()
    print("\n✅ All moderation fallback tests passed!")
