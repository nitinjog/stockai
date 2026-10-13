"""FastAPI app: JSON API + static single-page UI."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError

from . import config, db, pipeline
from .assemble import ffmpeg_ok
from .categories import CATEGORIES
from .models import FactSheet, Script

app = FastAPI(title="Video Studio")
pool = ThreadPoolExecutor(max_workers=2)
STATIC = Path(__file__).parent / "static"


class NewRun(BaseModel):
    category: str


def _run(rid: str) -> dict:
    r = db.get(rid)
    if not r:
        raise HTTPException(404, "Run not found")
    return r


def _need(r: dict, stage: str, status: str = "awaiting_approval"):
    try:
        pipeline.require(r, stage, status)
    except pipeline.StateError as e:
        raise HTTPException(409, str(e))


def _kick(rid: str, stage: str, fn, *args, **kw):
    db.update(rid, stage=stage, status="running", error="")  # mark running before the worker starts
    pool.submit(fn, rid, *args, **kw)


@app.get("/api/categories")
def categories():
    return [{"id": k, "label": v["label"], "brief": v["brief"], "disclaimer": v["disclaimer"]}
            for k, v in CATEGORIES.items()]


@app.get("/api/health")
def health():
    return {"ffmpeg": ffmpeg_ok()}


@app.get("/api/settings")
def get_settings():
    return config.public_settings()


@app.put("/api/settings")
def put_settings(update: dict = Body(...)):
    try:
        config.save_settings(update)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return config.public_settings()


@app.get("/api/runs")
def list_runs():
    return db.list_runs()


@app.post("/api/runs")
def create_run(body: NewRun):
    if body.category not in CATEGORIES:
        raise HTTPException(400, "Unknown category")
    r = db.create(body.category)
    pool.submit(pipeline.start_topics, r["id"])
    return r


@app.get("/api/runs/{rid}")
def get_run(rid: str):
    return _run(rid)


@app.post("/api/runs/{rid}/select-topic")
def select_topic(rid: str, body: dict = Body(...)):
    r = _run(rid)
    _need(r, "topics")
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(400, "title required")
    _kick(rid, "research", pipeline.start_research, title, body.get("angle", ""))
    return db.get(rid)


@app.post("/api/runs/{rid}/approve-factsheet")
def approve_factsheet(rid: str, body: dict = Body(default={})):
    r = _run(rid)
    _need(r, "research")
    if body.get("factsheet"):
        try:
            fs = FactSheet.model_validate(body["factsheet"]).model_dump()
        except ValidationError as e:
            raise HTTPException(400, str(e))
        fs["unverified_count"] = sum(not f["verified"] for f in fs["facts"])
        db.update(rid, data={"factsheet": fs})
    _kick(rid, "script", pipeline.start_script)
    return db.get(rid)


@app.post("/api/runs/{rid}/approve-script")
def approve_script(rid: str, body: dict = Body(...)):
    r = _run(rid)
    _need(r, "script")
    try:
        script = Script.model_validate(body["script"]).model_dump()
    except (ValidationError, KeyError) as e:
        raise HTTPException(400, str(e))
    if not script["scenes"]:
        raise HTTPException(400, "Script needs at least one scene")
    for sc, orig in zip(script["scenes"], body["script"]["scenes"]):
        if orig.get("is_disclaimer"):
            sc["is_disclaimer"] = True
    pipeline.prepare_media(rid, script)
    return db.get(rid)


@app.post("/api/runs/{rid}/approve-media")
def approve_media(rid: str):
    r = _run(rid)
    _need(r, "media")
    _kick(rid, "media", pipeline.start_media_and_video)
    return db.get(rid)


@app.post("/api/runs/{rid}/approve-video")
def approve_video(rid: str):
    r = _run(rid)
    _need(r, "video")
    pipeline.export(rid)
    return db.get(rid)


@app.post("/api/runs/{rid}/regenerate")
def regenerate(rid: str, body: dict = Body(default={})):
    """Redo the current gate's stage with editor feedback."""
    r = _run(rid)
    fb = (body.get("feedback") or "").strip()
    if r["status"] not in ("awaiting_approval", "failed"):
        raise HTTPException(409, "Run is busy")
    stage = r["stage"]
    if stage == "topics":
        _kick(rid, "topics", pipeline.start_topics, fb)
    elif stage == "research":
        d = r["data"]
        _kick(rid, "research", pipeline.start_research, d["topic"], d.get("angle", ""), fb)
    elif stage == "script":
        _kick(rid, "script", pipeline.start_script, fb)
    elif stage == "video":
        _kick(rid, "video", pipeline.restart_assembly)
    else:
        raise HTTPException(409, "Nothing to regenerate at this stage")
    return db.get(rid)


@app.post("/api/runs/{rid}/retry")
def retry(rid: str):
    """Resume a failed step (media generation skips files that already exist)."""
    r = _run(rid)
    _need(r, r["stage"], "failed")
    d = r["data"]
    if r["stage"] == "topics":
        _kick(rid, "topics", pipeline.start_topics)
    elif r["stage"] == "research":
        _kick(rid, "research", pipeline.start_research, d["topic"], d.get("angle", ""))
    elif r["stage"] == "script":
        _kick(rid, "script", pipeline.start_script)
    elif r["stage"] == "media":
        _kick(rid, "media", pipeline.start_media_and_video)
    else:
        _kick(rid, "video", pipeline.restart_assembly)
    return db.get(rid)


@app.get("/api/runs/{rid}/files/{path:path}")
def run_file(rid: str, path: str):
    _run(rid)
    base = db.run_dir(rid).resolve()
    f = (base / path).resolve()
    allowed = f.parent in (base, base / "media", base / "export")
    if not (allowed and f.is_file() and f.is_relative_to(base)):
        raise HTTPException(404, "File not found")
    return FileResponse(f)


app.mount("/", StaticFiles(directory=STATIC, html=True), name="static")
