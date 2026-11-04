"""Regression tests for the ai-service launcher and startup memory guards.

The Tavily commit (7fc9bb0) dropped the closing quote of ``SECRET_VARS`` and
the ``for var in $SECRET_VARS; do`` line from ``start.sh``. ``bash`` then
rejected the whole script with a syntax error, so uvicorn never started:
supervisord restarted the program until FATAL, every ``/api/ai/chat/stream``
request returned ECONNREFUSED, and the NestJS proxy answered with its
"Máy chủ AI đang khởi động lại" degraded reply.

``main.py`` has a second, latent variant of the same class of bug: its startup
hooks treated ``check_oom()`` (a dict) as a boolean, so the RAM guard never
triggered and the log line indexed a key (``available_gb``) that only exists
inside ``check_oom()["ram"]``.
"""
import shutil
import subprocess
from pathlib import Path

import pytest

SERVICE_DIR = Path(__file__).resolve().parents[1]
START_SH = SERVICE_DIR / "start.sh"
MAIN_PY = SERVICE_DIR / "main.py"


def test_start_script_has_valid_bash_syntax():
    bash = shutil.which("bash")
    if not bash:
        pytest.skip("bash not available")

    result = subprocess.run(
        [bash, "-n", str(START_SH)],
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr


def test_start_script_recovers_secrets_in_a_loop():
    text = START_SH.read_text(encoding="utf-8")

    # The list must be a closed string and the loop must exist, otherwise bash
    # swallows the following lines into the string literal.
    assert 'TAVILY_CIRCUIT_BREAKER_TTL"\n    for var in $SECRET_VARS; do' in text
    assert "uvicorn main:app" in text


def test_startup_hooks_use_the_check_oom_dict_contract():
    source = MAIN_PY.read_text(encoding="utf-8")

    # check_oom() returns a non-empty dict, so ``if not check_oom():`` is
    # always False. Guard on the explicit boolean instead.
    assert "if not check_oom():" not in source
    assert 'oom["safe_to_load_models"]' in source
