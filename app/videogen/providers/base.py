"""Provider interfaces and a retrying HTTP helper."""
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import httpx


class ProviderError(Exception):
    """Raised for any provider failure; the message is shown to the user."""


@dataclass
class TextResult:
    text: str
    sources: list = field(default_factory=list)  # [{"title":..., "url":...}]


class TextProvider(ABC):
    name = ""

    @abstractmethod
    def generate(self, prompt: str, *, system: str = "", json_mode: bool = False,
                 grounded: bool = False, task: str = "") -> TextResult:
        """grounded=True lets the model use live web search and return its sources."""


class ImageProvider(ABC):
    name = ""

    @abstractmethod
    def generate(self, prompt: str) -> bytes:
        """Return encoded image bytes (PNG/JPEG)."""


class TTSProvider(ABC):
    name = ""

    @abstractmethod
    def synthesize(self, text: str) -> bytes:
        """Return a complete WAV file."""


def post_json(client: httpx.Client | None, url: str, *, headers: dict, body: dict,
              timeout: float = 240, retries: int = 3) -> httpx.Response:
    own = client is None
    client = client or httpx.Client(timeout=timeout)
    try:
        last = ""
        for attempt in range(retries):
            try:
                r = client.post(url, headers=headers, json=body)
            except httpx.HTTPError as e:
                last = f"network error: {e}"
            else:
                if r.status_code < 400:
                    return r
                last = f"HTTP {r.status_code}: {r.text[:300]}"
                if r.status_code not in (429, 500, 502, 503, 504):
                    break
            time.sleep(min(2 ** attempt, 8) if attempt < retries - 1 else 0)
        raise ProviderError(last)
    finally:
        if own:
            client.close()


def pcm_to_wav(pcm: bytes, rate: int = 24000, channels: int = 1, width: int = 2) -> bytes:
    import io
    import wave
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(width)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()
