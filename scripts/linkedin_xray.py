#!/usr/bin/env python3
"""
Find public LinkedIn profile URLs through a normal web search ("X-ray search").

This NEVER logs in to LinkedIn and never requests linkedin.com. It asks a
search engine for `site:linkedin.com/in ...` and reads the result titles and
snippets, which are public. That means you only get what the search engine
shows (name, headline, location, current company), not full work history.
Use it to build a lead list, then capture the best people in full with the
dashboard's bookmarklet (Import LinkedIn page).

Usage:
  python scripts/linkedin_xray.py --title "Data Engineer" --location Cairo \
      --skills Python SQL --limit 30 --out leads.json

Engines:
  serper  serper.dev: 2,500 free searches (one-time). Set SERPER_API_KEY.
  serpapi serpapi.com: small free monthly plan. Set SERPAPI_KEY.
  google  Official Programmable Search API. Free: 100 queries/day (10 results
          each). Reliable. Setup (5 min): create a search engine at
          programmablesearchengine.google.com restricted to linkedin.com/in/*,
          copy its ID, and create an API key in Google Cloud ("Custom Search
          API"). Then set GOOGLE_API_KEY and GOOGLE_CSE_ID.
  ddg/bing  No key, but they throttle scripts and often return nothing or
          unrelated results. Best effort only.

Standard library only. Be polite: results are fetched slowly, and search
engines will rate-limit or show a CAPTCHA if you push hard. If that happens
the script stops and keeps what it already found.
"""
import argparse
import base64
import html
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
PROFILE_RE = re.compile(r"https?://(?:[a-z]{2,3}\.)?linkedin\.com/in/([^/?#\s\"']+)", re.I)


def build_query(title, location, skills, extra, exclude):
    parts = ["site:linkedin.com/in"]
    if title:
        parts.append(f'"{title}"')
    if location:
        parts.append(f'"{location}"')
    parts += [f'"{s}"' for s in skills]
    if extra:
        parts.append(extra)
    parts += [f'-"{x}"' for x in exclude]
    return " ".join(parts)


def fetch(url, data=None):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", "replace")


def strip_tags(s):
    s = html.unescape(re.sub(r"<[^>]+>", " ", s))
    s = re.sub(r"[‎‏‪-‮]", "", s)  # bidi marks around names
    return re.sub(r"\s+", " ", s).strip()


def unwrap_bing(href):
    """Bing wraps result links as bing.com/ck/a?...&u=a1<base64url of target>."""
    u = urllib.parse.parse_qs(urllib.parse.urlparse(href).query).get("u", [""])[0]
    if u.startswith("a1"):
        try:
            return base64.urlsafe_b64decode(u[2:] + "=" * (-len(u[2:]) % 4)).decode()
        except Exception:
            pass
    return href


def parse_ddg(page):
    out = []
    for m in re.finditer(r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>(.*?)(?=<a[^>]+class="result__a"|$)', page, re.S):
        href, title, rest = html.unescape(m.group(1)), strip_tags(m.group(2)), m.group(3)
        q = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
        url = q.get("uddg", [href])[0]
        sn = re.search(r'class="result__snippet"[^>]*>(.*?)</a>', rest, re.S)
        out.append((url, title, strip_tags(sn.group(1)) if sn else ""))
    return out


def parse_bing(page):
    out = []
    for block in re.findall(r'<li class="b_algo".*?</li>', page, re.S):
        a = re.search(r'<h2[^>]*><a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', block, re.S)
        if not a:
            continue
        sn = re.search(r"<p[^>]*>(.*?)</p>", block, re.S)
        out.append((unwrap_bing(html.unescape(a.group(1))), strip_tags(a.group(2)), strip_tags(sn.group(1)) if sn else ""))
    return out


def parse_google_cse(page):
    data = json.loads(page)
    return [(i.get("link", ""), i.get("title", ""), i.get("snippet", "")) for i in data.get("items", [])]


def post_json(url, payload, headers):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={**headers, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", "replace")


def search_page(engine, query, page_no):
    if engine == "serper":
        raw = post_json("https://google.serper.dev/search", {"q": query, "num": 10, "page": page_no + 1},
                        {"X-API-KEY": os.environ["SERPER_API_KEY"]})
        return [(i.get("link", ""), i.get("title", ""), i.get("snippet", "")) for i in json.loads(raw).get("organic", [])]
    if engine == "serpapi":
        qs = urllib.parse.urlencode({"engine": "google", "q": query, "num": 10, "start": page_no * 10,
                                     "api_key": os.environ["SERPAPI_KEY"]})
        data = json.loads(fetch("https://serpapi.com/search.json?" + qs))
        return [(i.get("link", ""), i.get("title", ""), i.get("snippet", "")) for i in data.get("organic_results", [])]
    if engine == "google":
        params = {
            "key": os.environ["GOOGLE_API_KEY"],
            "cx": os.environ["GOOGLE_CSE_ID"],
            "q": query,
            "start": page_no * 10 + 1,
        }
        return parse_google_cse(fetch("https://www.googleapis.com/customsearch/v1?" + urllib.parse.urlencode(params)))
    if engine == "bing":
        url = "https://www.bing.com/search?" + urllib.parse.urlencode({"q": query, "first": page_no * 10 + 1, "setlang": "en", "cc": "us"})
        return parse_bing(fetch(url))
    body = urllib.parse.urlencode({"q": query, "s": page_no * 30, "dc": page_no * 30 + 1}).encode()
    return parse_ddg(fetch("https://html.duckduckgo.com/html/", data=body))


def to_lead(url, title, snippet):
    m = PROFILE_RE.search(url)
    if not m:
        return None
    slug = urllib.parse.unquote(m.group(1)).lower()
    # Titles look like "Jane Doe - Senior Data Engineer - Acme | LinkedIn"
    clean = re.sub(r"\s*[|\-–]\s*LinkedIn\s*$", "", title, flags=re.I).strip()
    bits = [b.strip() for b in re.split(r"\s+[-–|]\s+", clean) if b.strip()]
    if not bits:
        return None
    name, rest = bits[0], bits[1:]
    headline = " - ".join(rest) if rest else None
    # Snippets often start "Location · Title · Company ..." or "Cairo, Egypt. 500+ connections..."
    location = None
    lm = re.match(r"^([A-Z][^·.|]{2,60}(?:,\s*[A-Z][^·.|]{2,40})*)\s*[·.|]", snippet)
    if lm:
        location = lm.group(1).strip()
    return {
        "profileUrl": f"https://www.linkedin.com/in/{slug}",
        "fullName": name,
        "headline": headline,
        "location": location,
        "snippet": snippet,
        "skills": [],
        "experience": [],
        "education": [],
        "capturedBy": "xray-script",
        "capturedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--title", required=True)
    ap.add_argument("--location", default="")
    ap.add_argument("--skills", nargs="*", default=[])
    ap.add_argument("--exclude", nargs="*", default=[], help="words to exclude, e.g. recruiter intern")
    ap.add_argument("--extra", default="", help="raw extra query text")
    ap.add_argument("--limit", type=int, default=30)
    ap.add_argument("--engine", choices=["serper", "serpapi", "google", "ddg", "bing"], default=None,
                    help="default: the first of serper/serpapi/google whose key is set, else ddg")
    ap.add_argument("--max-pages", type=int, default=6)
    ap.add_argument("--out", default="leads.json")
    a = ap.parse_args()

    if not a.engine:
        if os.environ.get("SERPER_API_KEY"):
            a.engine = "serper"
        elif os.environ.get("SERPAPI_KEY"):
            a.engine = "serpapi"
        elif os.environ.get("GOOGLE_API_KEY") and os.environ.get("GOOGLE_CSE_ID"):
            a.engine = "google"
        else:
            a.engine = "ddg"
    if a.engine == "google" and not (os.environ.get("GOOGLE_API_KEY") and os.environ.get("GOOGLE_CSE_ID")):
        sys.exit("--engine google needs GOOGLE_API_KEY and GOOGLE_CSE_ID (see the docstring).")
    query = build_query(a.title, a.location, a.skills, a.extra, a.exclude)
    print(f"Query: {query}", file=sys.stderr)
    leads, seen = [], set()
    for page_no in range(a.max_pages):
        try:
            results = search_page(a.engine, query, page_no)
        except urllib.error.HTTPError as e:
            print(f"Search engine refused (HTTP {e.code}); stopping with {len(leads)} leads. "
                  f"Check your API key/quota, or try another --engine.", file=sys.stderr)
            break
        except urllib.error.URLError as e:
            print(f"Network error: {e}", file=sys.stderr)
            break
        if not results:
            print("No more results (or the engine blocked the script with a CAPTCHA). "
                  "For reliable results set SERPER_API_KEY and use --engine serper.", file=sys.stderr)
            break
        for url, title, snippet in results:
            lead = to_lead(url, title, snippet)
            if lead and lead["profileUrl"] not in seen:
                seen.add(lead["profileUrl"])
                leads.append(lead)
        print(f"Page {page_no + 1}: {len(leads)} leads", file=sys.stderr)
        if len(leads) >= a.limit:
            break
        time.sleep(random.uniform(3, 6))

    leads = leads[: a.limit]
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(leads, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(leads)} leads to {a.out}. Upload it on the dashboard's Import page.", file=sys.stderr)


if __name__ == "__main__":
    main()
