"""
Fetches overnight market headlines from public RSS feeds, sends them to
Claude for summarization, and writes data/briefing.json for the dashboard
to consume. Designed to run daily via GitHub Actions.

Requires env var ANTHROPIC_API_KEY (set as a GitHub repo secret).
"""
import json
import os
import sys
from datetime import datetime, timezone

import feedparser
import requests

# RSS feeds to pull headlines from. Each entry is best-effort: if a feed
# fails or changes URL, the script logs it and moves on rather than failing
# the whole run. Check/update these paths periodically — publishers change
# their RSS structure without notice.
FEEDS = [
    ("Economic Times — Markets", "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms"),
    ("Economic Times — Top News", "https://economictimes.indiatimes.com/rssfeedstopstories.cms"),
    ("Moneycontrol — Markets", "https://www.moneycontrol.com/rss/marketreports.xml"),
    ("Moneycontrol — Business", "https://www.moneycontrol.com/rss/business.xml"),
    ("CNBC — Finance", "https://www.cnbc.com/id/20910258/device/rss/rss.html"),
]

MAX_HEADLINES_PER_FEED = 8
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = "claude-sonnet-4-6"


def fetch_headlines():
    items = []
    for source_name, url in FEEDS:
        try:
            resp = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
            parsed = feedparser.parse(resp.content)
            for entry in parsed.entries[:MAX_HEADLINES_PER_FEED]:
                items.append({
                    "source": source_name,
                    "title": entry.get("title", "").strip(),
                    "link": entry.get("link", ""),
                })
        except Exception as e:
            print(f"[warn] could not fetch {source_name} ({url}): {e}", file=sys.stderr)
    return items


def build_prompt(headlines):
    headline_block = "\n".join(f"- [{h['source']}] {h['title']}" for h in headlines) or "(no headlines retrieved)"
    return f"""You are producing a concise pre-market briefing for an Indian equity/options
trader reading this at 8:30 AM IST. Below are overnight headlines from financial
news sources. Write ORIGINAL summary sentences — never copy headline wording verbatim,
paraphrase in your own words.

Headlines:
{headline_block}

Respond with ONLY a raw JSON object (no markdown fences, no preamble), matching this
exact schema:
{{
  "global_events": "2-3 sentence summary of overnight global events and overall risk sentiment",
  "central_banks": "2-3 sentence summary of any central bank / rate-related news",
  "policy_sentiment": "1-2 sentence summary of any government/regulatory policy news relevant to Indian markets, or 'No major policy news overnight.' if none",
  "stocks_to_watch": ["Ticker or company — one short reason", "..."],
  "regime_hint": "range" | "trend-up" | "trend-down" | "volatile"
}}

For regime_hint, pick your best read of whether the overnight tone points to a
range-bound, trending, or volatile/event-driven session — this is a hint the
trader will review and can override, not a guarantee.
Keep stocks_to_watch to at most 6 items, only include names actually mentioned
in the headlines above.
"""


def call_claude(prompt):
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": ANTHROPIC_MODEL,
            "max_tokens": 800,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    text = "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text.split("\n", 1)[1] if "\n" in text else text
        if text.endswith("json"):
            text = text[:-4]
    return json.loads(text)


def main():
    if not ANTHROPIC_API_KEY:
        print("[error] ANTHROPIC_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    headlines = fetch_headlines()
    print(f"[info] fetched {len(headlines)} headlines")

    try:
        summary = call_claude(build_prompt(headlines))
    except Exception as e:
        print(f"[error] Claude summarization failed: {e}", file=sys.stderr)
        summary = {
            "global_events": "Auto-summary unavailable this run — check sources manually.",
            "central_banks": "Auto-summary unavailable this run — check sources manually.",
            "policy_sentiment": "Auto-summary unavailable this run — check sources manually.",
            "stocks_to_watch": [],
            "regime_hint": "range",
        }

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "headlines": headlines[:20],
        **summary,
    }

    os.makedirs("data", exist_ok=True)
    with open("data/briefing.json", "w") as f:
        json.dump(output, f, indent=2)

    print("[info] wrote data/briefing.json")


if __name__ == "__main__":
    main()
