import base64
import io
import json
import wave

import httpx
import pytest

from videogen import config, providers
from videogen.providers.anthropic_ import AnthropicText
from videogen.providers.base import ProviderError
from videogen.providers.gemini import GeminiImage, GeminiText, GeminiTTS
from videogen.providers.openai_ import OpenAIImage, OpenAIText, OpenAITTS


def client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_gemini_text_grounded_sends_search_tool_and_parses_sources():
    seen = {}

    def h(req):
        seen["body"], seen["key"], seen["url"] = json.loads(req.content), req.headers["x-goog-api-key"], str(req.url)
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "notes"}]},
                              "groundingMetadata": {"groundingChunks": [
                                  {"web": {"uri": "https://a.com", "title": "A"}},
                                  {"web": {"uri": "https://a.com", "title": "dup"}}]}}]})
    res = GeminiText("K", "gemini-x", client(h)).generate("q", system="s", grounded=True)
    assert res.text == "notes" and res.sources == [{"title": "A", "url": "https://a.com"}]
    assert seen["key"] == "K" and "gemini-x:generateContent" in seen["url"]
    assert seen["body"]["tools"] == [{"google_search": {}}]
    assert "generationConfig" not in seen["body"]  # JSON mime type can't combine with search


def test_gemini_json_mode_and_image_and_tts():
    def h(req):
        b = json.loads(req.content)
        if "generationConfig" in b and b["generationConfig"].get("responseModalities") == ["AUDIO"]:
            pcm = b"\x00\x00" * 2400
            return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"inlineData": {
                "mimeType": "audio/L16;codec=pcm;rate=24000", "data": base64.b64encode(pcm).decode()}}]}}]})
        if "generationConfig" in b and "IMAGE" in b["generationConfig"].get("responseModalities", []):
            return httpx.Response(200, json={"candidates": [{"content": {"parts": [
                {"text": "ok"}, {"inlineData": {"mimeType": "image/png", "data": base64.b64encode(b"PNG").decode()}}]}}]})
        assert b["generationConfig"]["responseMimeType"] == "application/json"
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "{}"}]}}]})
    c = client(h)
    assert GeminiText("K", "m", c).generate("x", json_mode=True).text == "{}"
    assert GeminiImage("K", "m", c).generate("x") == b"PNG"
    wav = GeminiTTS("K", "m", "Kore", c).synthesize("hi")
    with wave.open(io.BytesIO(wav)) as w:
        assert w.getframerate() == 24000 and w.getnframes() == 2400


def test_gemini_errors_are_provider_errors(monkeypatch):
    monkeypatch.setattr("time.sleep", lambda s: None)
    n = {"c": 0}

    def h(req):
        n["c"] += 1
        return httpx.Response(429, text="quota")
    with pytest.raises(ProviderError, match="429"):
        GeminiText("K", "m", client(h)).generate("x")
    assert n["c"] == 3  # retried
    with pytest.raises(ProviderError, match="no candidates"):
        GeminiText("K", "m", client(lambda r: httpx.Response(200, json={"promptFeedback": {}}))).generate("x")


def test_openai_adapters():
    def h(req):
        u = str(req.url)
        assert req.headers["authorization"] == "Bearer K"
        if u.endswith("/responses"):
            return httpx.Response(200, json={"output": [{"content": [{"type": "output_text", "text": "hello",
                                  "annotations": [{"type": "url_citation", "url": "https://o.com", "title": "O"}]}]}]})
        if u.endswith("/images/generations"):
            return httpx.Response(200, json={"data": [{"b64_json": base64.b64encode(b"IMG").decode()}]})
        assert json.loads(req.content)["response_format"] == "wav"
        return httpx.Response(200, content=b"RIFFwav")
    c = client(h)
    r = OpenAIText("K", "m", c).generate("x", grounded=True)
    assert r.text == "hello" and r.sources[0]["url"] == "https://o.com"
    assert OpenAIImage("K", "m", c).generate("x") == b"IMG"
    assert OpenAITTS("K", "m", "alloy", c).synthesize("x") == b"RIFFwav"


def test_anthropic_text_and_registry_rejects_media():
    def h(req):
        assert req.headers["x-api-key"] == "K" and "anthropic-version" in req.headers
        b = json.loads(req.content)
        assert b["tools"][0]["name"] == "web_search"
        return httpx.Response(200, json={"content": [{"type": "text", "text": "hi",
                              "citations": [{"url": "https://x.com", "title": "X"}]}]})
    r = AnthropicText("K", "claude-sonnet-5-5", client(h)).generate("x", grounded=True)
    assert r.text == "hi" and r.sources[0]["url"] == "https://x.com"

    with pytest.raises(ValueError, match="does not support image"):
        config.save_settings({"providers": {"image": "anthropic"}})


def test_registry_key_resolution(monkeypatch):
    with pytest.raises(ProviderError, match="No API key for gemini"):
        providers.get_text()
    config.save_settings({"keys": {"gemini": "saved-key"}})
    assert providers.get_text().key == "saved-key"
    monkeypatch.setenv("GEMINI_API_KEY", "env-key")
    assert providers.get_text().key == "env-key"  # environment wins
    pub = config.public_settings()
    assert pub["keys"] == {} and pub["key_status"]["gemini"] == "…-key"
    config.save_settings({"keys": {"gemini": "…-key"}})  # masked value echoed back must not overwrite
    assert config.load_settings()["keys"]["gemini"] == "saved-key"
    config.save_settings({"providers": {"text": "anthropic"}, "keys": {"anthropic": "a"}})
    assert providers.get_text().name == "anthropic"
    with pytest.raises(ProviderError, match="No API key for openai"):
        config.save_settings({"providers": {"image": "openai"}})
        providers.get_image()
