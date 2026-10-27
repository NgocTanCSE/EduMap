"""Unit tests for the moderation graceful-degradation path in LLMService.

These tests verify that when every AI provider is unreachable the moderation
flow still returns a safe result (instead of raising a 503 that blocks all
community posts). They also cover the HuggingFace and Cloudflare circuit
breakers so that repeated 401 / network-timeout calls are short-circuited.
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
    "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "XKIRO_API_KEY",
    "NVIDIA_API_KEY", "NIM_API_KEY",
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
    # breaker, try HF (not configured), and raise. moderate_text should catch
    # that and return the fallback.
    result = asyncio.run(svc.moderate_text("Nội dung cần kiểm duyệt"))
    assert result["is_safe"] is True
    assert result["confidence"] == 0.3
    assert "reason" in result
    print("✓ test_moderate_text_fallback_after_provider_failure")


def test_hf_circuit_breaker_blocks_repeated_401():
    """After HF returns 401, the circuit breaker should activate and skip
    subsequent HF calls for 5 minutes."""
    svc = _fresh_service()
    svc.has_hf = True
    svc.hf_token = "hf_invalid_token"
    svc.hf_router_url = "https://router.huggingface.co"
    svc.is_ready = True

    # Force the circuit breaker window open.
    svc._hf_down_until = time.monotonic() + 60  # 60s in the future

    raised = False
    try:
        svc._hf_generate("test prompt")
    except RuntimeError as e:
        raised = True
        assert "circuit breaker" in str(e).lower(), f"Expected circuit-breaker message, got: {e}"

    assert raised, "Expected _hf_generate to raise when circuit breaker is active"
    print("✓ test_hf_circuit_breaker_blocks_repeated_401")


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
    assert "kho+ng" not in cf_part, f"CF should not say 'not configured' when circuit-broken: {cf_part}"
    # Check that it contains the cooldown indication (either Vietnamese or
    # the circuit-breaker keyword in lowercase).
    err_lower = err.lower()
    assert "circuit" in err_lower or "gioi" in err_lower or "tam thoi" in err_lower or "cooldown" in err_lower, \
        f"Expected circuit-breaker indicator in error, got: {err}"
    print("\u2713 test_cf_circuit_breaker_message_not_misleading")
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
    assert "XKIRO: không cấu hình" in err
    assert "NVIDIA: không cấu hình" in err
    assert "Cloudflare/HF:" in err
    print("✓ test_generate_text_with_fallback_error_message")


def test_xkiro_circuit_breaker_blocks_repeated_failure():
    """After XKIRO network/curl failure, the circuit breaker should activate
    and skip subsequent XKIRO calls for 5 minutes — preventing the 20s
    timeout from burning the backend's request budget on every call."""
    svc = _fresh_service()
    svc.has_xkiro = True
    svc.xkiro_key = "fake-key"
    svc.xkiro_base = "https://api.xkiro.com/v1"
    svc.xkiro_model = "google/gemini-3.8-flash"
    svc.xkiro_timeout = 5
    svc.is_ready = True

    # Force the circuit breaker window open.
    svc._xkiro_down_until = time.monotonic() + 60

    raised = False
    try:
        svc._xkiro_generate("test prompt")
    except RuntimeError as e:
        raised = True
        assert "temporarily disabled" in str(e).lower(), f"Expected circuit-breaker message, got: {e}"

    assert raised, "Expected _xkiro_generate to raise when circuit breaker is active"
    print("✓ test_xkiro_circuit_breaker_blocks_repeated_failure")


def test_xkiro_401_sets_circuit_breaker():
    """When XKIRO returns 401 (invalid key), the circuit breaker should
    be set for 5 minutes and the error should mention auth, not 'empty response'."""
    svc = _fresh_service()
    svc.has_xkiro = True
    svc.xkiro_key = "fake-key"
    svc.xkiro_base = "https://api.xkiro.com/v1"
    svc.xkiro_model = "google/gemini-3.8-flash"
    svc.xkiro_timeout = 5
    svc.is_ready = True
    assert svc._xkiro_down_until == 0.0

    # Mock subprocess.run to return a 401 error JSON (not empty stdout)
    mock_proc = MagicMock()
    mock_proc.returncode = 0
    mock_proc.stdout = '{"error": {"message": "Invalid API key", "code": 401, "type": "authentication_error"}}'
    mock_proc.stderr = ""

    with patch("subprocess.run", return_value=mock_proc):
        raised = False
        try:
            svc._xkiro_generate("test prompt")
        except RuntimeError as e:
            raised = True
            assert "auth error" in str(e).lower(), f"Expected auth error, got: {e}"
            assert "empty response" not in str(e).lower(), f"Should NOT say 'empty response': {e}"

    assert raised, "Expected RuntimeError for 401 error response"
    assert svc._xkiro_down_until > time.monotonic(), "Circuit breaker should be set after 401"
    print("✓ test_xkiro_401_sets_circuit_breaker")


def test_xkiro_429_not_confused_with_empty():
    """When XKIRO returns 429 (rate limit), _xkiro_generate should
    raise a 'rate-limited' error — NOT a misleading 'empty response' that
    triggers the slow Cloudflare/HF fallback cascade."""
    svc = _fresh_service()
    svc.has_xkiro = True
    svc.xkiro_key = "fake-key"
    svc.xkiro_base = "https://api.xkiro.com/v1"
    svc.xkiro_model = "google/gemini-3.8-flash"
    svc.xkiro_timeout = 5
    svc.is_ready = True

    mock_proc = MagicMock()
    mock_proc.returncode = 0
    mock_proc.stdout = '{"error": {"message": "Rate limit exceeded", "code": 429}}'
    mock_proc.stderr = ""

    with patch("subprocess.run", return_value=mock_proc):
        raised = False
        try:
            svc._xkiro_generate("test prompt")
        except RuntimeError as e:
            raised = True
            assert "rate-limit" in str(e).lower() or "429" in str(e), f"Expected rate-limit/429 error, got: {e}"
            assert "empty response" not in str(e).lower(), f"Should NOT say 'empty response': {e}"

    assert raised, "Expected RuntimeError for 429 error response"
    print("✓ test_xkiro_429_not_confused_with_empty")


def test_nvidia_generate_exists_and_callable():
    """Verify _nvidia_generate method exists (was misnamed to _generate_text_with_fallback
    by an external process — this test guards against that regression)."""
    svc = _fresh_service()
    assert hasattr(svc, '_nvidia_generate'), "_nvidia_generate method must exist"
    assert callable(svc._nvidia_generate), "_nvidia_generate must be callable"
    print("✓ test_nvidia_generate_exists_and_callable")


def test_nvidia_circuit_breaker_blocks_repeated_failure():
    """After NVIDIA NIM network failure, the circuit breaker should activate."""
    svc = _fresh_service()
    svc.has_nvidia = True
    svc.nvidia_key = "fake-key"
    svc.nvidia_base = "https://integrate.api.nvidia.com/v1"
    svc.nvidia_chat_model = "meta/llama-3.1-8b-instruct"
    svc.nvidia_timeout = 5
    svc.is_ready = True

    svc._nvidia_down_until = time.monotonic() + 60

    raised = False
    try:
        svc._nvidia_generate("test prompt")
    except RuntimeError as e:
        raised = True
        assert "temporarily disabled" in str(e).lower(), f"Expected circuit-breaker message, got: {e}"

    assert raised, "Expected _nvidia_generate to raise when circuit breaker is active"
    print("✓ test_nvidia_circuit_breaker_blocks_repeated_failure")


def test_generate_text_with_fallback_calls_nvidia_generate():
    """Verify _generate_text_with_fallback correctly calls _nvidia_generate
    (not a misnamed duplicate method) when XKIRO is unavailable."""
    svc = _fresh_service()
    # Only NVIDIA configured (no XKIRO)
    svc.has_nvidia = True
    svc.has_xkiro = False
    svc.nvidia_key = "fake-key"
    svc.nvidia_base = "https://integrate.api.nvidia.com/v1"
    svc.nvidia_chat_model = "meta/llama-3.1-8b-instruct"
    svc.nvidia_timeout = 5
    svc.has_cf = False
    svc.has_hf = False
    svc.has_gemini = False
    svc.is_ready = True

    mock_proc = MagicMock()
    mock_proc.returncode = 0
    mock_proc.stdout = '{"choices": [{"message": {"content": "NVIDIA works!"}}]}'
    mock_proc.stderr = ""

    with patch("subprocess.run", return_value=mock_proc):
        result = svc._generate_text_with_fallback("test prompt")
        assert "NVIDIA works!" in result, f"Expected NVIDIA response, got: {result}"
    print("✓ test_generate_text_with_fallback_calls_nvidia_generate")


if __name__ == "__main__":
    test_moderate_text_returns_safe_fallback_when_no_providers()
    test_moderate_text_fallback_after_provider_failure()
    test_hf_circuit_breaker_blocks_repeated_401()
    test_cf_circuit_breaker_message_not_misleading()
    test_generate_text_with_fallback_error_message()
    test_xkiro_circuit_breaker_blocks_repeated_failure()
    test_xkiro_401_sets_circuit_breaker()
    test_xkiro_429_not_confused_with_empty()
    test_nvidia_generate_exists_and_callable()
    test_nvidia_circuit_breaker_blocks_repeated_failure()
    test_generate_text_with_fallback_calls_nvidia_generate()
    print("\n✅ All Python tests passed!")