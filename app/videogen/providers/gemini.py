"""Google Gemini (REST): text with Search grounding, image generation, TTS."""
import base64
import re

from .base import ImageProvider, ProviderError, TextProvider, TextResult, TTSProvider, pcm_to_wav, post_json

BASE = "https://generativelanguage.googleapis.com/v1beta"


def _call(client, key, model, body):
    r = post_json(client, f"{BASE}/models/{model}:generateContent",
                  headers={"x-goog-api-key": key}, body=body)
    data = r.json()
    if not data.get("candidates"):
        raise ProviderError(f"Gemini returned no candidates: {str(data)[:300]}")
    return data["candidates"][0]


def _parts(cand):
    return (cand.get("content") or {}).get("parts") or []


class GeminiText(TextProvider):
    name = "gemini"

    def __init__(self, key, model, client=None):
        self.key, self.model, self.client = key, model, client

    def generate(self, prompt, *, system="", json_mode=False, grounded=False, task=""):
        body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        if grounded:
            body["tools"] = [{"google_search": {}}]  # cannot be combined with JSON mime type
        elif json_mode:
            body["generationConfig"] = {"responseMimeType": "application/json"}
        cand = _call(self.client, self.key, self.model, body)
        text = "".join(p.get("text", "") for p in _parts(cand))
        if not text.strip():
            raise ProviderError(f"Gemini returned empty text (finishReason={cand.get('finishReason')})")
        sources, seen = [], set()
        for ch in (cand.get("groundingMetadata") or {}).get("groundingChunks", []):
            w = ch.get("web") or {}
            if w.get("uri") and w["uri"] not in seen:
                seen.add(w["uri"])
                sources.append({"title": w.get("title", ""), "url": w["uri"]})
        return TextResult(text, sources)


class GeminiImage(ImageProvider):
    name = "gemini"

    def __init__(self, key, model, client=None):
        self.key, self.model, self.client = key, model, client

    def generate(self, prompt):
        body = {"contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]}}
        cand = _call(self.client, self.key, self.model, body)
        for p in _parts(cand):
            inline = p.get("inlineData") or p.get("inline_data")
            if inline and inline.get("data"):
                return base64.b64decode(inline["data"])
        raise ProviderError("Gemini returned no image (the prompt may have been blocked)")


class GeminiTTS(TTSProvider):
    name = "gemini"

    def __init__(self, key, model, voice="Kore", client=None):
        self.key, self.model, self.voice, self.client = key, model, voice, client

    def synthesize(self, text):
        body = {"contents": [{"parts": [{"text": text}]}],
                "generationConfig": {"responseModalities": ["AUDIO"],
                                     "speechConfig": {"voiceConfig": {
                                         "prebuiltVoiceConfig": {"voiceName": self.voice}}}}}
        cand = _call(self.client, self.key, self.model, body)
        for p in _parts(cand):
            inline = p.get("inlineData") or p.get("inline_data")
            if inline and inline.get("data"):
                m = re.search(r"rate=(\d+)", inline.get("mimeType", ""))
                return pcm_to_wav(base64.b64decode(inline["data"]), int(m.group(1)) if m else 24000)
        raise ProviderError("Gemini returned no audio")
