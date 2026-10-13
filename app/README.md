# Video Studio

Research a trending topic, build a story, and produce a YouTube-ready video (script, AI images, voiceover, MP4,
captions, thumbnail, metadata) with **three human approval gates**. Runs locally as a web app.

Categories: Personal Finance (India) · AI Trends · Tech Breakthroughs · Cyber Trends · Mystery.

## Quick start
```bash
cd app
pip install -r requirements.txt     # also needs ffmpeg on PATH
export GEMINI_API_KEY=...           # one Google key covers text, images and voice (or use the Settings page)
uvicorn videogen.main:app --port 8000
# open http://localhost:8000
```
No key yet? Open **Settings** and switch all three stages to `mock` to try the whole flow offline.

## Pipeline and gates
1. **Topic**: headlines are collected from RSS/HackerNews/official feeds; the LLM ranks 5 topics. *You pick one.*
2. **Research**: web-grounded research produces a fact sheet. Each fact is checked in code against the sources the
   search actually returned; others are flagged `unverified`. **Gate 1: edit/remove facts, approve.**
3. **Script**: storyline, then a scene-by-scene script, then an automatic fact-check pass. A required disclaimer
   scene is always appended. **Gate 2: edit narration/prompts, approve**, then approve the **cost estimate**.
4. **Media**: one image per scene, voiceover, thumbnail. Retrying resumes without re-paying for finished files.
5. **Video**: FFmpeg (Ken Burns motion, lower-third text) and `captions.srt`. **Gate 3: preview, approve.**
6. **Export**: `data/runs/<id>/export/` has `video.mp4`, `thumbnail.jpg`, `captions.srt`, `metadata.json`,
   `script.md`. Upload manually to YouTube. Optional: put an `.mp3` in `data/music/` for quiet background music.

## Providers (set per stage in Settings)
| Stage | Gemini (default) | OpenAI | Anthropic |
|---|---|---|---|
| Text + web research | yes (Search grounding) | yes (web search) | yes (web search) |
| Images | yes | yes | no |
| Voiceover | yes | yes | no |

Keys come from environment variables (priority) or `data/settings.json` (mode 600, git-ignored). Model names are
editable because they change often. Cost rates in `config.py` are placeholders; edit them.

## Safeguards
- Finance: no buy/sell calls, target prices or guaranteed-returns phrases (scanned in code and flagged).
- Mystery: theories labelled as theories; no accusing private individuals. Cyber: defensive framing only.
- Every video ends with a spoken + on-screen disclaimer and its description lists sources.
- Always set YouTube's **"Altered or synthetic content"** disclosure (AI images and voice).
- Don't publish unreviewed output: mass-produced automated content can be demonetised.

## Tests
`cd app && python -m pytest tests -q` — offline: mock providers, stubbed HTTP, real FFmpeg.

## Not verified against live APIs
The Gemini/OpenAI/Anthropic adapters follow the documented REST shapes and are tested against stubbed responses,
not live calls. Run one real video with your key and report any 400s (model names, image/TTS request shapes).

## Deploy on Render
Uses `app/render.yaml` (a separate blueprint; the repo-root `render.yaml` is the old Node app) and `app/Dockerfile`
(FFmpeg is installed in the image).
1. Push the branch you want to deploy to GitHub.
2. Render dashboard → **New → Blueprint** → pick the repo and branch → set the blueprint path to `app/render.yaml`.
   (Or **New → Web Service**: Docker, root directory `app`, health check `/api/health`, add a disk mounted at
   `/data`, and the env vars below.)
3. Fill in `GEMINI_API_KEY` when prompted (OpenAI/Anthropic optional). `APP_PASSWORD` is auto-generated:
   read it under the service's **Environment** tab. Open the URL and log in with any username + that password.
4. Without `APP_PASSWORD` a Render deployment refuses to serve, so strangers can never spend your keys.

Notes: the disk (`/data`) needs a paid plan and holds runs, videos and settings; on the free plan everything is
lost on restart. If a deploy/restart interrupts a run it shows as failed with **Retry** (finished media is reused).
Prefer environment variables over saving keys in Settings on a server. Rendering uses RAM; if FFmpeg gets
OOM-killed on a small plan, lower the resolution (`video.width/height` in `data/settings.json`) or upgrade.
