"""Stage 3: storyline, narration script with scene shot list, and fact-check pass."""
import json

from .categories import CATEGORIES
from .guardrails import build_description, ensure_closing_scene, scan_script
from .llm import ask_json
from .models import FactCheck, Script, Storyline


def _ctx(category: str, factsheet: dict) -> tuple[str, str]:
    cfg = CATEGORIES[category]
    system = (f"You are a scriptwriter for a YouTube channel in the category '{cfg['label']}'. Tone: {cfg['tone']} "
              f"Hard rules: {cfg['rules']} Use only facts from the fact sheet; never invent statistics, quotes "
              "or sources. Where facts are uncertain, say so in the narration.")
    facts = "\n".join(f"- {f['claim']}" + ("" if f.get("verified") else " [UNVERIFIED]") for f in factsheet["facts"])
    sheet = (f"TOPIC: {factsheet['topic']}\nSUMMARY: {factsheet['summary']}\nFACTS:\n{facts}\n"
             f"UNCERTAINTIES: {'; '.join(factsheet.get('uncertainties', []))}")
    return system, sheet


def build_storyline(category: str, factsheet: dict, text, feedback: str = "") -> dict:
    system, sheet = _ctx(category, factsheet)
    prompt = (f"{sheet}\n\nDesign an engaging story arc: a cold-open hook in the first 10 seconds, rising "
              "curiosity, the key facts, a turn or surprise, and a useful takeaway with a call to action. "
              'JSON: {"logline","audience_hook","beats":[{"name","summary"}]}' +
              (f"\nEditor feedback: {feedback}" if feedback else ""))
    return ask_json(text, prompt, Storyline, system=system, task="storyline").model_dump()


def write_script(category: str, factsheet: dict, storyline: dict, text, minutes: float,
                 feedback: str = "") -> dict:
    system, sheet = _ctx(category, factsheet)
    n = max(4, round(minutes * 3))
    words = round(minutes * 140 / n)
    prompt = (f"{sheet}\n\nSTORYLINE:\n{json.dumps(storyline)}\n\n"
              f"Write the full narration as exactly {n} scenes of about {words} words each (spoken pace 140 wpm, "
              f"total about {round(minutes * 140)} words). Each scene needs: narration (spoken words only), "
              "visual_prompt (a detailed prompt for an AI image generator: subject, setting, mood, camera angle; "
              "no text, no logos, no real identifiable people), on_screen_text (max 6 words, may be empty). "
              "Also provide a title (under 70 chars, curiosity-driven but honest), a 2-3 sentence description, "
              "10 tags, a thumbnail_prompt and thumbnail_text (max 4 words). "
              'JSON: {"title","scenes":[{"n","narration","visual_prompt","on_screen_text"}],"description",'
              '"tags":[],"thumbnail_prompt","thumbnail_text"}' +
              (f"\nEditor feedback: {feedback}" if feedback else ""))
    script = ask_json(text, prompt, Script, system=system, task="script").model_dump()
    for i, sc in enumerate(script["scenes"], 1):
        sc["n"] = i
    return script


def finalize_script(category: str, script: dict, factsheet: dict) -> dict:
    """Deterministic post-processing: closing disclaimer scene, description, risky-phrase scan."""
    script = ensure_closing_scene(category, script)
    for i, sc in enumerate(script["scenes"], 1):
        sc["n"] = i
    script["full_description"] = build_description(category, script, factsheet)
    script["warnings"] = scan_script(category, script)
    script["word_count"] = sum(len(s["narration"].split()) for s in script["scenes"])
    return script


def fact_check(category: str, script: dict, factsheet: dict, text) -> list[dict]:
    system, sheet = _ctx(category, factsheet)
    narr = "\n".join(f"[{s['n']}] {s['narration']}" for s in script["scenes"] if not s.get("is_disclaimer"))
    prompt = (f"{sheet}\n\nSCRIPT:\n{narr}\n\nList every factual claim in the script that is NOT supported by the "
              "fact sheet, is marked [UNVERIFIED], overstates certainty, or is invented. Ignore opinions and "
              'transitions. JSON: {"issues":[{"scene":<number>,"claim":"...","problem":"..."}]} (empty list if none).')
    return [i.model_dump() for i in ask_json(text, prompt, FactCheck, system=system, task="factcheck").issues]
