"""Stage 4: cost estimate, per-scene images and voiceover, thumbnail."""
import io
import wave
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONT_PATHS = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
              "/Library/Fonts/Arial Bold.ttf", "C:/Windows/Fonts/arialbd.ttf"]


def font(size: int):
    for p in FONT_PATHS:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default(size)


def estimate_cost(script: dict, settings: dict) -> dict:
    n_img = len(script["scenes"]) + 1  # + thumbnail
    chars = sum(len(s["narration"]) for s in script["scenes"])
    lines, total = [], 0.0
    for stage, label, qty, unit in (("text", "Text (research + script)", 1, "text_per_run"),
                                    ("image", "Images", n_img, "image"),
                                    ("tts", "Voiceover", chars / 1000, "tts_per_1k_chars")):
        prov = settings["providers"][stage]
        rate = settings["costs"].get(prov, {}).get(unit, 0.0)
        cost = round(rate * qty, 3)
        total += cost
        lines.append({"item": label, "provider": prov, "quantity": round(qty, 2), "rate": rate, "usd": cost})
    return {"lines": lines, "total_usd": round(total, 2), "images": n_img, "narration_chars": chars,
            "note": "Rough estimate from editable placeholder rates in Settings, not a quote."}


def cover_crop(img: Image.Image, w: int, h: int) -> Image.Image:
    img = img.convert("RGB")
    scale = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def wrap(draw, text, fnt, max_w):
    lines, cur = [], ""
    for word in text.split():
        t = f"{cur} {word}".strip()
        if draw.textlength(t, font=fnt) <= max_w or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = word
    return lines + ([cur] if cur else [])


def overlay_text(img: Image.Image, text: str) -> Image.Image:
    """Lower-third caption with a dark gradient for legibility."""
    if not text.strip():
        return img
    w, h = img.size
    img = img.convert("RGBA")
    shade = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    band = int(h * 0.30)
    for i in range(band):
        sd.line([(0, h - band + i), (w, h - band + i)], fill=(0, 0, 0, int(190 * i / band)))
    img = Image.alpha_composite(img, shade)
    d = ImageDraw.Draw(img)
    fnt = font(max(14, h // 16))
    lines = wrap(d, text, fnt, w * 0.84)
    lh = fnt.size * 1.25
    y = h - h * 0.07 - lh * len(lines)
    for ln in lines:
        d.text(((w - d.textlength(ln, font=fnt)) / 2, y), ln, font=fnt, fill="white",
               stroke_width=max(1, h // 360), stroke_fill="black")
        y += lh
    return img.convert("RGB")


def wav_duration(data: bytes) -> float:
    with wave.open(io.BytesIO(data)) as w:
        return w.getnframes() / float(w.getframerate())


def make_thumbnail(base_png: bytes, title_text: str) -> Image.Image:
    img = cover_crop(Image.open(io.BytesIO(base_png)), 1280, 720)
    if title_text.strip():
        d = ImageDraw.Draw(img)
        fnt = font(110)
        lines = wrap(d, title_text.upper(), fnt, 1100)[:3]
        y = 720 - 70 - 130 * len(lines)
        for ln in lines:
            d.text((70, y), ln, font=fnt, fill="#ffe600", stroke_width=6, stroke_fill="black")
            y += 130
    return img


def generate_media(script: dict, run_dir: Path, settings: dict, image, tts, progress=lambda m: None) -> dict:
    """Generate (or reuse existing) scene images and audio. Idempotent so failed runs resume."""
    media = run_dir / "media"
    media.mkdir(parents=True, exist_ok=True)
    style = settings["video"]["style"]
    out = {"scenes": []}
    total = len(script["scenes"])
    for sc in script["scenes"]:
        n = sc["n"]
        ip, ap = media / f"scene_{n:02d}.png", media / f"scene_{n:02d}.wav"
        progress(f"Scene {n}/{total}: image")
        if not ip.exists():
            ip.write_bytes(image.generate(f"{sc['visual_prompt']}. Style: {style}"))
        progress(f"Scene {n}/{total}: voiceover")
        if not ap.exists():
            ap.write_bytes(tts.synthesize(sc["narration"]))
        out["scenes"].append({"n": n, "image": ip.name, "audio": ap.name,
                              "duration": round(wav_duration(ap.read_bytes()), 2)})
    progress("Thumbnail")
    tp = media / "thumbnail.jpg"
    if not tp.exists():
        prompt = script.get("thumbnail_prompt") or script["scenes"][0]["visual_prompt"]
        make_thumbnail(image.generate(f"{prompt}. Style: {style}"), script.get("thumbnail_text", "")
                       ).save(tp, quality=90)
    out["thumbnail"] = tp.name
    return out
