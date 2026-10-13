"""Stage 1-2: discover trending topics, then research the chosen one into a fact sheet."""
import datetime as dt
import xml.etree.ElementTree as ET
from urllib.parse import urlparse

import httpx

from .categories import CATEGORIES, HN
from .llm import ask_json
from .models import FactSheet, TopicList

UA = {"User-Agent": "Mozilla/5.0 (compatible; videogen/0.1)"}


def _text(el, *names):
    for n in names:
        c = el.find(n)
        if c is not None and (c.text or c.get("href")):
            return (c.text or c.get("href")).strip()
    return ""


def parse_feed(xml: str, source: str) -> list[dict]:
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return []
    out = []
    for it in root.iter():
        tag = it.tag.split("}")[-1]
        if tag not in ("item", "entry"):
            continue
        kids = {c.tag.split("}")[-1]: c for c in it}
        title = (kids["title"].text or "").strip() if "title" in kids else ""
        link = ""
        if "link" in kids:
            link = (kids["link"].text or kids["link"].get("href") or "").strip()
        date = ""
        for k in ("pubDate", "published", "updated"):
            if k in kids and kids[k].text:
                date = kids[k].text.strip()
                break
        if title and link:
            out.append({"title": title, "url": link, "source": source, "published": date})
    return out


def collect_candidates(category: str, client: httpx.Client | None = None, per_feed: int = 8) -> list[dict]:
    """Best-effort fetch of headlines; individual feed failures are skipped."""
    cfg = CATEGORIES[category]
    own = client is None
    client = client or httpx.Client(timeout=15, headers=UA, follow_redirects=True)
    items: list[dict] = []
    try:
        for url in cfg["feeds"]:
            try:
                r = client.get(url)
                r.raise_for_status()
                items += parse_feed(r.text, urlparse(url).netloc)[:per_feed]
            except (httpx.HTTPError, ValueError):
                continue
        if cfg["hn"]:
            try:
                r = client.get(HN)
                r.raise_for_status()
                for h in r.json().get("hits", [])[:20]:
                    if h.get("title"):
                        items.append({"title": h["title"], "source": "hacker-news",
                                      "url": h.get("url") or f"https://news.ycombinator.com/item?id={h.get('objectID')}",
                                      "published": h.get("created_at", "")})
            except (httpx.HTTPError, ValueError):
                pass
    finally:
        if own:
            client.close()
    seen, uniq = set(), []
    for i in items:
        k = i["title"].lower()[:60]
        if k not in seen:
            seen.add(k)
            uniq.append(i)
    return uniq


def discover_topics(category: str, text, client=None, feedback: str = "") -> dict:
    cfg = CATEGORIES[category]
    today = dt.date.today().isoformat()
    cands = collect_candidates(category, client)
    system = (f"You are a research editor for a YouTube channel. Today is {today}. "
              f"Category: {cfg['label']}. {cfg['brief']}")
    if cands:
        listing = "\n".join(f"{i + 1}. {c['title']} [{c['source']}] {c['url']}" for i, c in enumerate(cands[:80]))
        prompt = (f"Here are recent headlines:\n{listing}\n\n"
                  "Pick the 5 strongest video topics: genuinely trending now, supported by more than one source "
                  "where possible, and interesting to a general audience. Merge duplicates. "
                  'Return JSON: {"topics":[{"title","why_trending","angle","evidence_urls":[urls from the list]}]}.')
    else:
        notes = text.generate(f"Search the web for what is trending this week in: {cfg['brief']}. "
                              "List 8 specific candidate stories with dates.", system=system,
                              grounded=True, task="research_notes")
        prompt = (f"Search notes:\n{notes.text}\n\nSources: {notes.sources}\n\n"
                  "Pick the 5 strongest video topics. "
                  'Return JSON: {"topics":[{"title","why_trending","angle","evidence_urls"}]}.')
    if feedback:
        prompt += f"\n\nEditor feedback to apply: {feedback}"
    topics = ask_json(text, prompt, TopicList, system=system, task="topics")
    return {"candidates": cands[:40], "topics": [t.model_dump() for t in topics.topics[:5]]}


def _norm(u: str) -> str:
    return u.strip().rstrip("/").lower()


def research_topic(category: str, topic: str, text, angle: str = "", feedback: str = "") -> dict:
    cfg = CATEGORIES[category]
    today = dt.date.today().isoformat()
    system = (f"You are a careful fact researcher. Today is {today}. Category: {cfg['label']}. "
              f"Rules: {cfg['rules']}")
    notes = text.generate(
        f"Research this topic using current web sources: {topic}. Angle: {angle or 'general audience'}.\n"
        "Collect concrete, checkable facts with dates, numbers and who said them. Note where sources disagree "
        "and what is still unknown. Prefer primary and reputable sources." +
        (f"\nEditor feedback: {feedback}" if feedback else ""),
        system=system, grounded=True, task="research_notes")
    src_list = [{"title": s.get("title", ""), "url": s["url"]} for s in notes.sources]
    prompt = (f"Research notes:\n{notes.text}\n\nSources (the only valid citations):\n"
              + "\n".join(f"- {s['title']}: {s['url']}" for s in src_list) +
              f"\n\nProduce a fact sheet for the topic '{topic}'. Each fact must be a single checkable claim and "
              "its source_url MUST be copied from the sources list above; use an empty string if no listed "
              "source supports it. Include uncertainties (disputed or unknown points). "
              'JSON: {"topic","summary","facts":[{"claim","source_url"}],"sources":[{"title","url"}],"uncertainties":[]}')
    fs = ask_json(text, prompt, FactSheet, system=system, task="factsheet")
    if src_list:
        valid, sources = {_norm(s["url"]) for s in src_list}, src_list
    else:  # provider gave no machine-readable sources: keep the model's list but mark every fact unverified
        valid, sources = set(), [s.model_dump() for s in fs.sources]
    for f in fs.facts:
        f.verified = bool(f.source_url) and _norm(f.source_url) in valid
    out = fs.model_dump()
    out["sources"] = sources
    out["unverified_count"] = sum(not f["verified"] for f in out["facts"])
    return out
