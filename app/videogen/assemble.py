"""Stage 5: build the MP4 (FFmpeg) and SRT captions."""
import io
import re
import shutil
import subprocess
from pathlib import Path

from PIL import Image

from . import config
from .media import cover_crop, overlay_text


def ffmpeg_ok() -> bool:
    return shutil.which("ffmpeg") is not None


def _run(cmd: list[str]):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {r.stderr[-600:]}")


def _ts(t: float) -> str:
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def build_srt(script: dict, durations: dict[int, float], pad: float) -> str:
    """Split each scene's narration into sentences, timed proportionally to length."""
    out, t, idx = [], 0.0, 1
    for sc in script["scenes"]:
        dur = durations[sc["n"]]
        parts = [p for p in re.split(r"(?<=[.!?])\s+", sc["narration"].strip()) if p]
        total = sum(len(p) for p in parts) or 1
        cur = t
        for p in parts:
            d = dur * len(p) / total
            out.append(f"{idx}\n{_ts(cur)} --> {_ts(cur + d)}\n{p}\n")
            idx += 1
            cur += d
        t += dur + pad
    return "\n".join(out)


def assemble(script: dict, media: dict, run_dir: Path, settings: dict, progress=lambda m: None) -> dict:
    if not ffmpeg_ok():
        raise RuntimeError("ffmpeg is not installed. Install it (e.g. `apt install ffmpeg`) and retry.")
    v = settings["video"]
    w, h, fps, pad = v["width"], v["height"], v["fps"], 0.4
    md = run_dir / "media"
    work = run_dir / "build"
    work.mkdir(exist_ok=True)
    clips, durations = [], {}
    by_n = {s["n"]: s for s in script["scenes"]}
    for m in media["scenes"]:
        n = m["n"]
        progress(f"Rendering scene {n}/{len(media['scenes'])}")
        frame = work / f"frame_{n:02d}.png"
        img = cover_crop(Image.open(md / m["image"]), w, h)
        overlay_text(img, by_n[n].get("on_screen_text", "")).save(frame)
        dur = m["duration"] + pad
        durations[n] = m["duration"]
        clip = work / f"clip_{n:02d}.mp4"
        frames = max(1, int(dur * fps))
        if v.get("ken_burns", True):
            vf = (f"scale={w * 3 // 2}:-2,zoompan=z='min(zoom+0.0006,1.12)':x='iw/2-(iw/zoom/2)':"
                  f"y='ih/2-(ih/zoom/2)':d={frames}:s={w}x{h}:fps={fps},format=yuv420p")
        else:
            vf = f"scale={w}:{h},format=yuv420p,fps={fps}"
        _run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-i", str(frame), "-i", str(md / m["audio"]),
              "-vf", vf, "-af", f"apad=pad_dur={pad},aresample=44100", "-ac", "2",
              "-t", f"{dur:.3f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
              "-c:a", "aac", "-b:a", "160k", str(clip)])
        clips.append(clip)
    progress("Joining scenes")
    lst = work / "list.txt"
    lst.write_text("".join(f"file '{c.name}'\n" for c in clips))
    out = run_dir / "video.mp4"
    mdir = config.DATA_DIR / "music"  # optional: drop an mp3 here for quiet background music
    music = next(iter(sorted(mdir.glob("*.mp3"))), None) if mdir.exists() else None
    if music:
        joined = work / "joined.mp4"
        _run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy",
              str(joined)])
        _run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(joined), "-stream_loop", "-1", "-i", str(music),
              "-filter_complex", "[1:a]volume=0.07[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]",
              "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", str(out)])
    else:
        _run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy",
              "-movflags", "+faststart", str(out)])
    (run_dir / "captions.srt").write_text(build_srt(script, durations, pad))
    shutil.rmtree(work, ignore_errors=True)
    total = sum(durations.values()) + pad * len(durations)
    return {"video": out.name, "captions": "captions.srt", "duration": round(total, 1),
            "size_mb": round(out.stat().st_size / 1e6, 2)}
