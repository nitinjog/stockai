"""Topic categories: research sources, tone and compliance rules."""
from urllib.parse import quote_plus


def gnews(q: str, india: bool = False) -> str:
    loc = "hl=en-IN&gl=IN&ceid=IN:en" if india else "hl=en-US&gl=US&ceid=US:en"
    return f"https://news.google.com/rss/search?q={quote_plus(q + ' when:7d')}&{loc}"


HN = "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30"

CATEGORIES = {
    "personal_finance_india": {
        "label": "Personal Finance (India)",
        "brief": "Personal finance for Indian viewers: taxes, savings, UPI/banking, mutual funds, insurance, "
                 "loans, RBI/SEBI rules and money habits. Use INR and Indian examples.",
        "feeds": [gnews("personal finance India", True), gnews("RBI new rules", True),
                  gnews("SEBI mutual fund investors", True), gnews("income tax India changes", True),
                  "https://www.rbi.org.in/pressreleases_rss.xml", "https://www.sebi.gov.in/sebirss.xml"],
        "hn": False,
        "tone": "Clear, practical and reassuring. Explain jargon. Educational, never promotional.",
        "rules": "Educational only. Never tell viewers to buy, sell or hold a specific stock, fund or crypto asset. "
                 "No guaranteed or promised returns. No target prices. Explain risks alongside any strategy. "
                 "Verify rules, rates and dates against official sources (RBI, SEBI, Income Tax Dept).",
        "disclaimer": "This video is for education only and is not financial advice. "
                      "Please consult a SEBI-registered adviser before making investment decisions.",
    },
    "ai_trends": {
        "label": "AI Trends (Global)",
        "brief": "The most important recent developments in artificial intelligence worldwide: models, "
                 "products, regulation, business and societal impact.",
        "feeds": [gnews("artificial intelligence"), gnews("AI regulation"), gnews("generative AI launch")],
        "hn": True,
        "tone": "Energetic and curious, but grounded. Separate hype from verified capability.",
        "rules": "Distinguish announced claims from independently verified results. Name the source of benchmarks.",
        "disclaimer": "Some details may change quickly. Check the linked sources for the latest information.",
    },
    "tech_breakthroughs": {
        "label": "Technology Breakthroughs (Global)",
        "brief": "Recent real-world technology breakthroughs: science, hardware, energy, space, biotech and "
                 "engineering. Prefer peer-reviewed or primary-source announcements.",
        "feeds": [gnews("technology breakthrough"), gnews("scientists discover new technology"),
                  gnews("quantum computing OR fusion OR battery breakthrough")],
        "hn": True,
        "tone": "Awe and clarity. Explain why it matters and what is still unproven.",
        "rules": "Say whether a result is lab-stage, peer-reviewed, or commercial. Do not overstate timelines.",
        "disclaimer": "Early-stage research may not translate into real-world products.",
    },
    "cyber_trends": {
        "label": "Cyber Trends (Global)",
        "brief": "Current cybersecurity trends: major breaches, ransomware, vulnerabilities, scams, "
                 "state-backed activity and practical protection steps for ordinary people and companies.",
        "feeds": [gnews("cybersecurity breach"), gnews("ransomware attack"), gnews("zero-day vulnerability"),
                  "https://www.cisa.gov/cybersecurity-advisories/all.xml"],
        "hn": True,
        "tone": "Urgent but calm. Always end with concrete protective steps.",
        "rules": "Defensive framing only. Do not give step-by-step attack instructions, working exploit code "
                 "or detail that helps someone commit the crime. Do not name unconfirmed attackers as fact.",
        "disclaimer": "Information is for awareness and defence only.",
    },
    "mystery": {
        "label": "Mystery",
        "brief": "Intriguing mysteries: unsolved cases, historical puzzles, unexplained discoveries and "
                 "newly surfaced evidence. Prefer topics with fresh news or developments.",
        "feeds": [gnews("unsolved mystery new evidence"), gnews("archaeologists unexplained discovery"),
                  gnews("cold case breakthrough"), "https://www.reddit.com/r/UnresolvedMysteries/top/.rss?t=week"],
        "hn": False,
        "tone": "Suspenseful storytelling with discipline: keep what is known, what is claimed and what is "
                "speculation clearly separate.",
        "rules": "Label theories as theories. Never present speculation as fact. Do not accuse real, named private "
                 "individuals of crimes. Be respectful to victims and families. Avoid graphic detail.",
        "disclaimer": "Some details in this video are unverified or disputed. Theories are presented as theories, "
                      "not established facts.",
    },
}
