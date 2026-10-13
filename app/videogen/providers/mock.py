"""Offline providers so the whole pipeline runs without API keys (tests, demos)."""
import io
import json
import math
import struct
import wave

from PIL import Image, ImageDraw

from .base import ImageProvider, TextProvider, TextResult, TTSProvider

_SCENES = [
    ("A quiet newsroom at dawn, screens glowing with breaking headlines.", "The story begins"),
    ("A sweeping aerial view of a city grid at night, lights pulsing like data.", "Why it matters"),
    ("A researcher examining a glowing holographic chart in a dim lab.", "What we know"),
    ("Two diverging paths in a misty forest, one lit, one dark.", "What is disputed"),
    ("A hand placing the final piece into a large jigsaw puzzle.", "Putting it together"),
]


def _scene_json(n=5):
    return [{"n": i + 1,
             "narration": (f"Scene {i + 1}. This is placeholder narration used by the mock provider "
                           f"to exercise the full pipeline end to end without calling any real API."),
             "visual_prompt": _SCENES[i % len(_SCENES)][0],
             "on_screen_text": _SCENES[i % len(_SCENES)][1]} for i in range(n)]


CANNED = {
    "topics": {"topics": [
        {"title": f"Mock topic {i}", "why_trending": "Appears across several sources this week.",
         "angle": "What it means for ordinary people.", "evidence_urls": ["https://example.com/a"]}
        for i in range(1, 6)]},
    "research_notes": "Mock research notes. Fact one is widely reported. Fact two is disputed.",
    "factsheet": {"topic": "Mock topic 1", "summary": "A mock summary of the researched topic.",
                  "facts": [{"claim": "Mock fact one.", "source_url": "https://example.com/a"},
                            {"claim": "Mock fact two.", "source_url": "https://example.com/b"},
                            {"claim": "Mock fact without a real source.", "source_url": "https://unknown.invalid/x"}],
                  "sources": [], "uncertainties": ["Fact two is disputed."]},
    "storyline": {"logline": "A mock logline.", "audience_hook": "What if everything you knew was wrong?",
                  "beats": [{"name": "Hook", "summary": "Open with a question."},
                            {"name": "Build", "summary": "Lay out the facts."},
                            {"name": "Twist", "summary": "Reveal the dispute."},
                            {"name": "Takeaway", "summary": "What to do next."}]},
    "script": {"title": "Mock Video Title: What You Need To Know",
               "scenes": _scene_json(),
               "description": "A mock description of the video.", "tags": ["mock", "demo"],
               "thumbnail_prompt": "A dramatic split-lit scene with a question mark silhouette.",
               "thumbnail_text": "WHAT NOW?"},
    "factcheck": {"issues": [{"scene": 3, "claim": "Mock fact without a real source.",
                              "problem": "No supporting source in the fact sheet."}]},
}


class MockText(TextProvider):
    name = "mock"

    def generate(self, prompt, *, system="", json_mode=False, grounded=False, task=""):
        if grounded:
            return TextResult(CANNED["research_notes"],
                              [{"title": "Example A", "url": "https://example.com/a"},
                               {"title": "Example B", "url": "https://example.com/b"}])
        out = CANNED.get(task, {})
        return TextResult(out if isinstance(out, str) else json.dumps(out))


class MockImage(ImageProvider):
    name = "mock"

    def generate(self, prompt):
        h = sum(map(ord, prompt)) % 255
        img = Image.new("RGB", (640, 360))
        px = ImageDraw.Draw(img)
        for y in range(360):
            px.line([(0, y), (640, y)], fill=(h // 3 + y // 5, 40 + y // 6, 90 + (h + y) // 4))
        px.text((20, 20), prompt[:70], fill=(255, 255, 255))
        buf = io.BytesIO()
        img.save(buf, "PNG")
        return buf.getvalue()


class MockTTS(TTSProvider):
    name = "mock"

    def synthesize(self, text):
        secs = max(0.6, len(text.split()) * 0.12)
        rate = 16000
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(rate)
            w.writeframes(b"".join(struct.pack("<h", int(2000 * math.sin(2 * math.pi * 220 * i / rate)))
                                   for i in range(int(secs * rate))))
        return buf.getvalue()
