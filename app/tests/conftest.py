import pytest

from videogen import config


@pytest.fixture(autouse=True)
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DATA_DIR", tmp_path)
    for k in ("GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"):
        monkeypatch.delenv(k, raising=False)
    return tmp_path


@pytest.fixture
def mock_settings():
    """All stages on the offline mock provider with a tiny, fast video."""
    return config.save_settings({
        "providers": {"text": "mock", "image": "mock", "tts": "mock"},
        "video": {"width": 320, "height": 180, "fps": 10, "ken_burns": False, "target_minutes": 1}})
