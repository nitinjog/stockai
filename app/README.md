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
