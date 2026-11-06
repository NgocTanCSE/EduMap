
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



    assert 'DB_SYNC"\n    for var in $SECRET_VARS; do' in text
    assert "uvicorn main:app" in text


def test_startup_hooks_use_the_check_oom_dict_contract():
    source = MAIN_PY.read_text(encoding="utf-8")



    assert "if not check_oom():" not in source
    assert 'oom["safe_to_load_models"]' in source
