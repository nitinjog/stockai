"""Settings: defaults, persistence and API-key lookup."""
import copy
import json
import os
import threading
from pathlib import Path

DATA_DIR = Path(os.environ.get("VIDEOGEN_DATA", Path(__file__).resolve().parent.parent / "data"))
STAGES = ("text", "image", "tts")
PROVIDERS = ("gemini", "openai", "anthropic", "mock")
# Anthropic's API has no image or speech endpoints.
PROVIDER_STAGES = {
    "gemini": ("text", "image", "tts"),
    "openai": ("text", "image", "tts"),
    "anthropic": ("text",),
    "mock": ("text", "image", "tts"),
}
KEY_ENV = {
    "gemini": ("GEMINI_API_KEY", "GOOGLE_API_KEY"),
    "openai": ("OPENAI_API_KEY",),
    "anthropic": ("ANTHROPIC_API_KEY",),
}

DEFAULT_SETTINGS = {
    "providers": {"text": "gemini", "image": "gemini", "tts": "gemini"},
    "models": {
        "gemini": {"text": "gemini-2.5-flash", "image": "gemini-2.5-flash-image",
                   "tts": "gemini-2.5-flash-preview-tts"},
        "openai": {"text": "gpt-4o-mini", "image": "gpt-image-1", "tts": "gpt-4o-mini-tts"},
        "anthropic": {"text": "claude-sonnet-5-5"},
    },
    "voice": {"gemini": "Kore", "openai": "alloy"},
    "keys": {},
    # Rough placeholder USD rates used only for the pre-generation estimate.
    # Check your provider's pricing page and edit these.
    "costs": {
        "gemini": {"text_per_run": 0.05, "image": 0.04, "tts_per_1k_chars": 0.02},
        "openai": {"text_per_run": 0.05, "image": 0.04, "tts_per_1k_chars": 0.015},
        "anthropic": {"text_per_run": 0.15, "image": 0.0, "tts_per_1k_chars": 0.0},
        "mock": {"text_per_run": 0.0, "image": 0.0, "tts_per_1k_chars": 0.0},
    },
    "video": {"target_minutes": 6, "width": 1920, "height": 1080, "fps": 25,
              "ken_burns": True,
              "style": ("cinematic editorial illustration, consistent muted colour palette, "
                        "dramatic lighting, 16:9, no text, no logos, no real people's faces")},
}

_lock = threading.Lock()


def _merge(base: dict, over: dict) -> dict:
    for k, v in over.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            _merge(base[k], v)
        else:
            base[k] = v
    return base


def settings_path() -> Path:
    return DATA_DIR / "settings.json"


def load_settings() -> dict:
    s = copy.deepcopy(DEFAULT_SETTINGS)
    p = settings_path()
    if p.exists():
        try:
            _merge(s, json.loads(p.read_text()))
        except (OSError, ValueError):
            pass
    return s


def save_settings(update: dict) -> dict:
    """Merge `update` into stored settings. Empty-string keys are ignored (keep existing)."""
    with _lock:
        s = load_settings()
        update = copy.deepcopy(update)
        keys = update.pop("keys", {}) or {}
        _merge(s, update)
        for prov, val in keys.items():
            if prov in PROVIDERS and isinstance(val, str) and val.strip() and "…" not in val:
                s["keys"][prov] = val.strip()
        for stage, prov in s["providers"].items():
            if stage not in STAGES or prov not in PROVIDERS:
                raise ValueError(f"invalid provider selection {stage}={prov}")
            if stage not in PROVIDER_STAGES[prov]:
                raise ValueError(f"{prov} does not support {stage}")
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        p = settings_path()
        p.write_text(json.dumps(s, indent=2))
        os.chmod(p, 0o600)
        return s


def get_key(provider: str, settings: dict | None = None) -> str | None:
    for env in KEY_ENV.get(provider, ()):
        if os.environ.get(env):
            return os.environ[env]
    return (settings or load_settings())["keys"].get(provider) or None


def public_settings() -> dict:
    """Settings safe to send to the browser: keys masked, plus key availability."""
    s = load_settings()
    s["key_status"] = {}
    for prov in KEY_ENV:
        k = get_key(prov, s)
        s["key_status"][prov] = ("…" + k[-4:]) if k else ""
    s["keys"] = {}
    return s
