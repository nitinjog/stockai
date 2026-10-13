import shutil
import time

import pytest
from fastapi.testclient import TestClient

from videogen.main import app

pytestmark = pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg required")


def wait(c, rid, stage, status="awaiting_approval", timeout=60):
    end = time.time() + timeout
    while time.time() < end:
        r = c.get(f"/api/runs/{rid}").json()
        if r["status"] == "failed":
            raise AssertionError(r["error"])
        if r["stage"] == stage and r["status"] == status:
            return r
        time.sleep(0.1)
    raise AssertionError(f"timeout waiting for {stage}/{status}: {r}")


def test_full_pipeline_with_human_gates(mock_settings, data_dir):
    c = TestClient(app)
    rid = c.post("/api/runs", json={"category": "mystery"}).json()["id"]

    r = wait(c, rid, "topics")
    assert len(r["data"]["topics"]) == 5
    # Gates cannot be skipped
    assert c.post(f"/api/runs/{rid}/approve-script", json={"script": {}}).status_code == 409

    c.post(f"/api/runs/{rid}/select-topic", json={"title": "Mock topic 1"})
    r = wait(c, rid, "research")
    facts = r["data"]["factsheet"]["facts"]
    assert [f["verified"] for f in facts] == [True, True, False]  # third source not in researched set

    c.post(f"/api/runs/{rid}/approve-factsheet")
    r = wait(c, rid, "script")
    script = r["data"]["script"]
    assert script["scenes"][-1]["is_disclaimer"]
    assert "unverified or disputed" in script["scenes"][-1]["narration"]
    assert script["fact_check"] and "SOURCES" in script["full_description"]

    script["scenes"][0]["narration"] = "Edited by a human."
    r = c.post(f"/api/runs/{rid}/approve-script", json={"script": script}).json()
    assert r["stage"] == "media" and r["data"]["cost"]["total_usd"] == 0
    assert r["data"]["script"]["scenes"][0]["narration"] == "Edited by a human."
    assert r["data"]["script"]["scenes"][-1]["is_disclaimer"]

    c.post(f"/api/runs/{rid}/approve-media")
    r = wait(c, rid, "video", timeout=120)
    assert r["data"]["video"]["duration"] > 3
    assert c.get(f"/api/runs/{rid}/files/video.mp4").status_code == 200
    assert c.get(f"/api/runs/{rid}/files/media/thumbnail.jpg").status_code == 200
    assert c.get(f"/api/runs/{rid}/files/../../settings.json").status_code == 404

    c.post(f"/api/runs/{rid}/approve-video")
    r = c.get(f"/api/runs/{rid}").json()
    assert r["status"] == "done"
    assert {"video.mp4", "thumbnail.jpg", "metadata.json", "captions.srt", "script.md"} <= set(r["data"]["export"])


def test_missing_key_fails_visibly_and_is_retryable(data_dir):
    c = TestClient(app)  # default provider = gemini, no key
    rid = c.post("/api/runs", json={"category": "ai_trends"}).json()["id"]
    end = time.time() + 10
    while time.time() < end:
        r = c.get(f"/api/runs/{rid}").json()
        if r["status"] == "failed":
            break
        time.sleep(0.1)
    assert r["status"] == "failed" and "No API key for gemini" in r["error"]
    c.put("/api/settings", json={"providers": {"text": "mock"}})
    c.post(f"/api/runs/{rid}/retry")
    assert wait(c, rid, "topics")["data"]["topics"]
