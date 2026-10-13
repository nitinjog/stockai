"""SQLite run store. Each run is one row with a JSON blob; files live in data/runs/<id>/."""
import json
import sqlite3
import threading
import time
import uuid
from pathlib import Path

from . import config

_lock = threading.Lock()


def _conn():
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(config.DATA_DIR / "videogen.db")
    c.row_factory = sqlite3.Row
    c.execute("""CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, category TEXT, stage TEXT, status TEXT,
                 message TEXT, error TEXT, data TEXT, created REAL, updated REAL)""")
    return c


def run_dir(run_id: str) -> Path:
    d = config.DATA_DIR / "runs" / run_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _row(r) -> dict:
    d = dict(r)
    d["data"] = json.loads(d["data"] or "{}")
    return d


def create(category: str) -> dict:
    rid, now = uuid.uuid4().hex[:10], time.time()
    with _lock, _conn() as c:
        c.execute("INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,?)",
                  (rid, category, "topics", "running", "Starting", "", "{}", now, now))
    return get(rid)


def get(rid: str) -> dict | None:
    with _lock, _conn() as c:
        r = c.execute("SELECT * FROM runs WHERE id=?", (rid,)).fetchone()
    return _row(r) if r else None


def list_runs() -> list[dict]:
    with _lock, _conn() as c:
        rows = c.execute("SELECT * FROM runs ORDER BY created DESC LIMIT 100").fetchall()
    out = []
    for r in rows:
        d = _row(r)
        d["data"] = {"topic": d["data"].get("topic", "")}
        out.append(d)
    return out


def update(rid: str, *, stage=None, status=None, message=None, error=None, data: dict | None = None):
    """Merge `data` keys into the run's data blob; other fields replace when provided."""
    with _lock, _conn() as c:
        r = c.execute("SELECT * FROM runs WHERE id=?", (rid,)).fetchone()
        if not r:
            return
        cur = json.loads(r["data"] or "{}")
        cur.update(data or {})
        c.execute("UPDATE runs SET stage=?, status=?, message=?, error=?, data=?, updated=? WHERE id=?",
                  (stage or r["stage"], status or r["status"], message if message is not None else r["message"],
                   error if error is not None else r["error"], json.dumps(cur), time.time(), rid))
