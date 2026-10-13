"""Run state machine. Each step runs in a worker thread and ends at a human approval gate.

stage/status flow:
  topics(running) -> topics(awaiting_approval: pick a topic)
  research -> research(awaiting_approval: approve fact sheet)          [gate 1]
  script   -> script(awaiting_approval: approve script)                [gate 2]
  media(awaiting_approval: approve cost) -> media(running) -> video(running)
  video(awaiting_approval: preview)                                    [gate 3]
  export(done)
"""
import json
import shutil
import traceback

from . import db, providers
from .assemble import assemble
from .categories import CATEGORIES
from .config import load_settings
from .guardrails import disclaimer
from .media import estimate_cost, generate_media
from .providers.base import ProviderError
from .research import discover_topics, research_topic
from .story import build_storyline, fact_check, finalize_script, write_script


class StateError(Exception):
    """The requested action is not valid for the run's current stage."""


def require(run: dict, stage: str, status: str = "awaiting_approval"):
    if run["stage"] != stage or run["status"] != status:
        raise StateError(f"Run is at {run['stage']}/{run['status']}; expected {stage}/{status}.")


def _guard(rid: str, stage: str):
    """Decorator-ish helper: run fn, converting failures into a visible failed state."""
    def deco(fn):
        def wrapper(*a, **kw):
            try:
                fn(*a, **kw)
            except ProviderError as e:
                db.update(rid, stage=stage, status="failed", error=str(e))
            except Exception as e:  # noqa: BLE001 - surface anything to the user, keep trace in message
                traceback.print_exc()
                db.update(rid, stage=stage, status="failed", error=f"{type(e).__name__}: {e}")
        return wrapper
    return deco


def start_topics(rid: str, feedback: str = ""):
    @_guard(rid, "topics")
    def go():
        run = db.get(rid)
        db.update(rid, stage="topics", status="running", message="Scanning news and trends", error="")
        res = discover_topics(run["category"], providers.get_text(), feedback=feedback)
        db.update(rid, status="awaiting_approval", message="Pick a topic", data=res)
    go()


def start_research(rid: str, topic: str, angle: str = "", feedback: str = ""):
    @_guard(rid, "research")
    def go():
        run = db.get(rid)
        db.update(rid, stage="research", status="running", message="Researching with live sources", error="",
                  data={"topic": topic, "angle": angle})
        fs = research_topic(run["category"], topic, providers.get_text(), angle, feedback)
        db.update(rid, status="awaiting_approval", message="Review the fact sheet", data={"factsheet": fs})
    go()


def start_script(rid: str, feedback: str = ""):
    @_guard(rid, "script")
    def go():
        run = db.get(rid)
        s = load_settings()
        text = providers.get_text(s)
        d = run["data"]
        db.update(rid, stage="script", status="running", message="Building storyline", error="")
        story = d.get("storyline") if (feedback == "" and d.get("storyline")) else \
            build_storyline(run["category"], d["factsheet"], text, feedback)
        db.update(rid, message="Writing script", data={"storyline": story})
        script = write_script(run["category"], d["factsheet"], story, text, s["video"]["target_minutes"], feedback)
        db.update(rid, message="Fact-checking script")
        script = finalize_script(run["category"], script, d["factsheet"])
        script["fact_check"] = fact_check(run["category"], script, d["factsheet"], text)
        db.update(rid, status="awaiting_approval", message="Review the script", data={"script": script})
    go()


def prepare_media(rid: str, script: dict):
    """After gate 2: store the (possibly edited) script and show the cost estimate."""
    run = db.get(rid)
    script = finalize_script(run["category"], script, run["data"]["factsheet"])
    script["fact_check"] = run["data"]["script"].get("fact_check", [])
    s = load_settings()
    db.update(rid, stage="media", status="awaiting_approval", message="Approve the generation cost",
              error="", data={"script": script, "cost": estimate_cost(script, s)})


def start_media_and_video(rid: str):
    @_guard(rid, "media")
    def go():
        run = db.get(rid)
        s = load_settings()
        script, rd = run["data"]["script"], db.run_dir(rid)
        image, tts = providers.get_image(s), providers.get_tts(s)
        db.update(rid, stage="media", status="running", message="Generating images and voiceover", error="")
        media = generate_media(script, rd, s, image, tts, lambda m: db.update(rid, message=m))
        db.update(rid, stage="video", message="Assembling video", data={"media": media})
        try:
            video = assemble(script, media, rd, s, lambda m: db.update(rid, message=m))
        except Exception as e:  # keep generated media so "retry" resumes without re-paying
            db.update(rid, stage="video", status="failed", error=f"{type(e).__name__}: {e}")
            return
        db.update(rid, stage="video", status="awaiting_approval", message="Preview the video",
                  data={"video": video})
    go()


def restart_assembly(rid: str):
    @_guard(rid, "video")
    def go():
        run = db.get(rid)
        s = load_settings()
        db.update(rid, stage="video", status="running", message="Assembling video", error="")
        video = assemble(run["data"]["script"], run["data"]["media"], db.run_dir(rid), s,
                         lambda m: db.update(rid, message=m))
        db.update(rid, status="awaiting_approval", message="Preview the video", data={"video": video})
    go()


def export(rid: str) -> dict:
    run = db.get(rid)
    rd = db.run_dir(rid)
    script = run["data"]["script"]
    out = rd / "export"
    out.mkdir(exist_ok=True)
    shutil.copy(rd / "video.mp4", out / "video.mp4")
    shutil.copy(rd / "media" / "thumbnail.jpg", out / "thumbnail.jpg")
    shutil.copy(rd / "captions.srt", out / "captions.srt")
    meta = {"title": script["title"], "description": script["full_description"], "tags": script["tags"],
            "category": CATEGORIES[run["category"]]["label"], "disclaimer": disclaimer(run["category"]),
            "upload_notes": ["In YouTube Studio, set 'Altered or synthetic content' to Yes (AI visuals + voice).",
                             "Upload captions.srt under Subtitles. Review every claim in the description's sources.",
                             "Finance/mystery/cyber videos: re-read the disclaimer text before publishing."]}
    (out / "metadata.json").write_text(json.dumps(meta, indent=2))
    (out / "script.md").write_text(f"# {script['title']}\n\n" + "\n\n".join(
        f"## Scene {s['n']}\n{s['narration']}\n\n*Visual:* {s['visual_prompt']}" for s in script["scenes"]))
    db.update(rid, stage="export", status="done", message="Exported", data={"export": sorted(p.name for p in out.iterdir())})
    return meta
