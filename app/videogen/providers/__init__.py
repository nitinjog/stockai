"""Provider registry: build the configured provider for each stage."""
from ..config import PROVIDER_STAGES, get_key, load_settings
from .anthropic_ import AnthropicText
from .base import ImageProvider, ProviderError, TextProvider, TTSProvider  # noqa: F401
from .gemini import GeminiImage, GeminiText, GeminiTTS
from .mock import MockImage, MockText, MockTTS
from .openai_ import OpenAIImage, OpenAIText, OpenAITTS


def _resolve(stage: str, settings: dict):
    prov = settings["providers"][stage]
    if stage not in PROVIDER_STAGES.get(prov, ()):
        raise ProviderError(f"{prov} does not support {stage}. Pick another provider for '{stage}' in Settings.")
    key = None
    if prov != "mock":
        key = get_key(prov, settings)
        if not key:
            raise ProviderError(f"No API key for {prov}. Add it in Settings or set the environment variable "
                                f"(or switch the '{stage}' stage to 'mock').")
    model = settings["models"].get(prov, {}).get(stage)
    return prov, key, model


def get_text(settings=None, client=None) -> TextProvider:
    s = settings or load_settings()
    prov, key, model = _resolve("text", s)
    return {"gemini": lambda: GeminiText(key, model, client), "openai": lambda: OpenAIText(key, model, client),
            "anthropic": lambda: AnthropicText(key, model, client), "mock": MockText}[prov]()


def get_image(settings=None, client=None) -> ImageProvider:
    s = settings or load_settings()
    prov, key, model = _resolve("image", s)
    return {"gemini": lambda: GeminiImage(key, model, client), "openai": lambda: OpenAIImage(key, model, client),
            "mock": MockImage}[prov]()


def get_tts(settings=None, client=None) -> TTSProvider:
    s = settings or load_settings()
    prov, key, model = _resolve("tts", s)
    voice = s["voice"].get(prov, "")
    return {"gemini": lambda: GeminiTTS(key, model, voice, client),
            "openai": lambda: OpenAITTS(key, model, voice, client), "mock": MockTTS}[prov]()
