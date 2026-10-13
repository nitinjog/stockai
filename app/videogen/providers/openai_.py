"""OpenAI: Responses API (with web search), image generation, speech."""
import base64

from .base import ImageProvider, ProviderError, TextProvider, TextResult, TTSProvider, post_json

BASE = "https://api.openai.com/v1"


def _h(key):
    return {"Authorization": f"Bearer {key}"}


class OpenAIText(TextProvider):
    name = "openai"

    def __init__(self, key, model, client=None):
        self.key, self.model, self.client = key, model, client

    def generate(self, prompt, *, system="", json_mode=False, grounded=False, task=""):
        body = {"model": self.model, "input": prompt}
        if system:
            body["instructions"] = system
        if grounded:
            body["tools"] = [{"type": "web_search"}]
        elif json_mode:
            body["text"] = {"format": {"type": "json_object"}}
            body["input"] = prompt + "\n\nRespond with a single JSON object."
        data = post_json(self.client, f"{BASE}/responses", headers=_h(self.key), body=body).json()
        text, sources, seen = "", [], set()
        for item in data.get("output", []):
            for c in item.get("content", []) or []:
                if c.get("type") == "output_text":
                    text += c.get("text", "")
                    for a in c.get("annotations", []):
                        if a.get("type") == "url_citation" and a.get("url") not in seen:
                            seen.add(a["url"])
                            sources.append({"title": a.get("title", ""), "url": a["url"]})
        if not text.strip():
            raise ProviderError("OpenAI returned empty text")
        return TextResult(text, sources)


class OpenAIImage(ImageProvider):
    name = "openai"

    def __init__(self, key, model, client=None):
        self.key, self.model, self.client = key, model, client

    def generate(self, prompt):
        body = {"model": self.model, "prompt": prompt, "size": "1536x1024", "n": 1}
        data = post_json(self.client, f"{BASE}/images/generations", headers=_h(self.key), body=body).json()
        b64 = (data.get("data") or [{}])[0].get("b64_json")
        if not b64:
            raise ProviderError("OpenAI returned no image")
        return base64.b64decode(b64)


class OpenAITTS(TTSProvider):
    name = "openai"

    def __init__(self, key, model, voice="alloy", client=None):
        self.key, self.model, self.voice, self.client = key, model, voice, client

    def synthesize(self, text):
        body = {"model": self.model, "voice": self.voice, "input": text, "response_format": "wav"}
        return post_json(self.client, f"{BASE}/audio/speech", headers=_h(self.key), body=body).content
