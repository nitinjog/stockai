"""Anthropic Messages API. Text only (no image or speech endpoints exist)."""
from .base import ProviderError, TextProvider, TextResult, post_json

URL = "https://api.anthropic.com/v1/messages"


class AnthropicText(TextProvider):
    name = "anthropic"

    def __init__(self, key, model, client=None):
        self.key, self.model, self.client = key, model, client

    def generate(self, prompt, *, system="", json_mode=False, grounded=False, task=""):
        body = {"model": self.model, "max_tokens": 8000,
                "messages": [{"role": "user", "content": prompt}]}
        if json_mode:
            system = (system + "\n\n" if system else "") + "Respond with a single valid JSON object and nothing else."
        if system:
            body["system"] = system
        if grounded:
            body["tools"] = [{"type": "web_search_20250305", "name": "web_search", "max_uses": 6}]
        data = post_json(self.client, URL, body=body,
                         headers={"x-api-key": self.key, "anthropic-version": "2023-06-01"}).json()
        text, sources, seen = "", [], set()
        for block in data.get("content", []):
            if block.get("type") == "text":
                text += block.get("text", "")
                for c in block.get("citations") or []:
                    if c.get("url") and c["url"] not in seen:
                        seen.add(c["url"])
                        sources.append({"title": c.get("title", ""), "url": c["url"]})
            elif block.get("type") == "web_search_tool_result" and isinstance(block.get("content"), list):
                for r in block["content"]:
                    if r.get("url") and r["url"] not in seen:
                        seen.add(r["url"])
                        sources.append({"title": r.get("title", ""), "url": r["url"]})
        if not text.strip():
            raise ProviderError("Anthropic returned empty text")
        return TextResult(text, sources)
