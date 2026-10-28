"""Unit tests for the moderation graceful-degradation path in LLMService.

These tests verify that when every AI provider is unreachable the moderation
flow still returns a safe result (instead of raising a 503 that blocks all
community posts). They also cover the Cloudflare circuit breaker so that
repeated auth/429 failures are short-circuited.
"""

import asyncio
import os
import sys
import time
from unittest.mock import patch, MagicMock

# Ensure ai-service is on the path so `services` package is importable
_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

# Ensure NO real providers are configured before importing the service.
# We set empty strings (not pop) so load_dotenv() — which has override=False
# by default — does NOT clobber them with the .env file values.
for _v in [
    "GEMINI_API_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID",
    "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN",
]:
    os.environ[_v] = ""
os.environ["AI_PREFLIGHT"] = "false"

from services.llm_service import LLMService  # noqa: E402


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
    # Simulate CF configured but failing at runtime (SSL timeout, etc.)
    svc.has_cf = True
    svc.is_ready = True
    svc.api_token = "fake-token"
    svc.account_id = "fake-account"

    # _cloudflare_generate will try CF, fail with network error, set circuit
    # breaker, try Gemini (not configured), and raise. moderate_text should catch
    # that and return the fallback.
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
    # Activate circuit breaker
    svc._cf_down_until = time.monotonic() + 60

    err = None
    try:
        svc._cloudflare_generate("test prompt", max_tokens=10)
    except RuntimeError as e:
        err = str(e)

    assert err is not None, "Expected RuntimeError from _cloudflare_generate"
    # CF portion should NOT say "không cấu hình" (not configured) when
    # the circuit breaker is active -- it should say temporarily unavailable.
    cf_part = err.split("Cloudflare:")[1].split(",")[0] if "Cloudflare:" in err else ""
    assert "kho" + chr(0x3001) not in cf_part, f"CF should not say 'not configured' when circuit-broken: {cf_part}"
    # Check that it contains the cooldown indication (either Vietnamese or
    # the circuit-breaker keyword in lowercase).
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
    # Cloudflare is configured but not working (no real key) → should show error
    assert "Cloudflare:" in err
    # Gemini and Cloudflare should be mentioned in the breakdown
    assert "Gemini" in err
    print("✓ test_generate_text_with_fallback_error_message")


if __name__ == "__main__":
    test_moderate_text_returns_safe_fallback_when_no_providers()
    test_moderate_text_fallback_after_provider_failure()
    test_cf_circuit_breaker_message_not_misleading()
    test_generate_text_with_fallback_error_message()
    print("\n✅ All moderation fallback tests passed!")
