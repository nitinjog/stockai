"""Code-enforced compliance checks (not left to the LLM)."""
import re

from .categories import CATEGORIES

FINANCE_PATTERNS = [
    r"\bguaranteed? (returns?|profits?)\b", r"\bsure[- ]?shot\b", r"\b(you should|must|go) (buy|sell)\b",
    r"\btarget price\b", r"\bcan'?t lose\b", r"\brisk[- ]?free\b", r"\bdouble your money\b",
]
GENERAL_PATTERNS = [r"\b100% (safe|certain|proven)\b"]
CYBER_PATTERNS = [r"\bstep[- ]by[- ]step.{0,40}(exploit|hack|attack)\b"]
MYSTERY_PATTERNS = [r"\b(is|was) (definitely|clearly) (the )?(killer|murderer)\b"]
BY_CATEGORY = {"personal_finance_india": FINANCE_PATTERNS, "cyber_trends": CYBER_PATTERNS,
               "mystery": MYSTERY_PATTERNS}


def disclaimer(category: str) -> str:
    return CATEGORIES[category]["disclaimer"]


def scan_script(category: str, script: dict) -> list[dict]:
    """Return warnings for risky phrases in narration/on-screen text."""
    pats = GENERAL_PATTERNS + BY_CATEGORY.get(category, [])
    out = []
    for sc in script["scenes"]:
        text = f"{sc.get('narration', '')} {sc.get('on_screen_text', '')}"
        for p in pats:
            m = re.search(p, text, re.I)
            if m:
                out.append({"scene": sc["n"], "phrase": m.group(0),
                            "problem": "Risky phrasing for this category; rewrite or remove."})
    return out


def ensure_closing_scene(category: str, script: dict) -> dict:
    """Guarantee the disclaimer is spoken and shown in the last scene (idempotent)."""
    text = disclaimer(category)
    last = script["scenes"][-1]
    if last.get("is_disclaimer"):
        last.update(narration=text, on_screen_text="Disclaimer")
        return script
    script["scenes"].append({"n": len(script["scenes"]) + 1, "narration": text,
                             "visual_prompt": "Calm abstract gradient background, soft light, minimal",
                             "on_screen_text": "Disclaimer", "is_disclaimer": True})
    return script


def build_description(category: str, script: dict, factsheet: dict) -> str:
    parts = [script.get("description", "").strip(), ""]
    parts.append("SOURCES")
    for s in factsheet.get("sources", []):
        parts.append(f"- {s.get('title') or s['url']}: {s['url']}")
    parts += ["", "DISCLAIMER", disclaimer(category), "",
              "Visuals in this video are AI-generated illustrations and voiceover is synthetic."]
    return "\n".join(parts).strip()
