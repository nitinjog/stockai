import httpx

from videogen import guardrails
from videogen.llm import parse_json
from videogen.research import collect_candidates, parse_feed

RSS = """<rss><channel><item><title>RBI cuts repo rate</title><link>https://n.com/1</link>
<pubDate>Mon, 01 Jan 2026</pubDate></item><item><title>No link</title></item></channel></rss>"""
ATOM = """<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom story</title>
<link href="https://n.com/2"/><updated>2026-01-01</updated></entry></feed>"""


def test_parse_feed_rss_and_atom_and_garbage():
    assert parse_feed(RSS, "x")[0]["url"] == "https://n.com/1" and len(parse_feed(RSS, "x")) == 1
    assert parse_feed(ATOM, "x")[0]["url"] == "https://n.com/2"
    assert parse_feed("<<not xml", "x") == []


def test_collect_candidates_tolerates_failures_and_dedupes():
    def h(req):
        u = str(req.url)
        if "hn.algolia" in u:
            return httpx.Response(200, json={"hits": [{"title": "HN thing", "url": "https://hn.com/x"}]})
        if "cisa.gov" in u:
            return httpx.Response(500)
        return httpx.Response(200, text=RSS)
    items = collect_candidates("cyber_trends", httpx.Client(transport=httpx.MockTransport(h)))
    titles = [i["title"] for i in items]
    assert titles.count("RBI cuts repo rate") == 1 and "HN thing" in titles


def test_parse_json_handles_fences_and_prose():
    assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json('Sure! Here: {"a": [1,2]} done') == {"a": [1, 2]}


def test_finance_guardrails():
    script = {"scenes": [{"n": 1, "narration": "This fund has guaranteed returns, so you should buy now.",
                          "on_screen_text": ""}, {"n": 2, "narration": "Fees matter.", "on_screen_text": ""}]}
    w = guardrails.scan_script("personal_finance_india", script)
    assert {x["scene"] for x in w} == {1} and len(w) == 2
    assert guardrails.scan_script("ai_trends", {"scenes": [{"n": 1, "narration": "guaranteed returns",
                                                           "on_screen_text": ""}]}) == []


def test_closing_scene_is_idempotent():
    s = {"scenes": [{"n": 1, "narration": "x", "visual_prompt": "v", "on_screen_text": ""}]}
    guardrails.ensure_closing_scene("personal_finance_india", s)
    guardrails.ensure_closing_scene("personal_finance_india", s)
    assert len(s["scenes"]) == 2 and "not financial advice" in s["scenes"][-1]["narration"]
