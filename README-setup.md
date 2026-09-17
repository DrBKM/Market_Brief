# Setting up the daily briefing on github.com/DrBKMask

## 1. Getting the page online

1. In your `DrBKMask` repo (or a new one), add `market-briefing.html` — you can
   rename it `index.html` if you want it at the repo's root URL.
2. Repo Settings → Pages → set the source branch (usually `main`) and folder
   (`/root` or `/docs`).
3. GitHub gives you a URL like `https://drbkmask.github.io/<repo-name>/`.

## 2. About the password gate — read this before relying on it

The page includes a password prompt, but **GitHub Pages sites are always
fully public** — there is no server in front of them to actually check
credentials. The JavaScript gate:

- stops the page from being readable at a glance, and
- keeps casual visitors and search-engine indexing out in practice,

but anyone who opens the browser's dev tools, views page source, or disables
JavaScript can see the content underneath. If you need real privacy (not
just a soft deterrent), you have two better options:

- **Keep the repo private** and view the file locally / via GitHub's own
  raw-file preview, rather than publishing through Pages at all.
- **Use a host that supports real authentication** — e.g. Cloudflare Pages
  or Netlify both offer simple password-protection or access-control
  features that check credentials server-side, unlike GitHub Pages.

To change the gate's password: open `market-briefing.html`, find the
`PW_HASH` constant near the bottom, and follow the one-line instructions
in the comment above it (compute a SHA-256 hash of your new password in
any browser console and paste it in). The current placeholder password is
`changeme` — change it before sharing the link with anyone.

## 3. Automating the daily refresh

`refresh-briefing.yml` (put it at `.github/workflows/refresh-briefing.yml`)
and `build-briefing.js` (put it at `scripts/build-briefing.js`) are a
**skeleton**, not a finished pipeline. They show the shape of a scheduled
job — GitHub Actions runs it every weekday morning, it regenerates the
page, commits, and pushes — but the actual data-fetching and writing logic
is left as TODOs, for two reasons:

- **Source access**: Bloomberg, CNBC, and The Economic Times gate most of
  their content behind terms of service that prohibit automated scraping.
  Building a scraper against them isn't something to wire up without
  reading (and complying with) those terms — official APIs, licensed data
  feeds, or RSS feeds where publishers offer them are the legitimate path.
  Moneycontrol and the NSE website are more open but still expect scraping
  to respect `robots.txt` and reasonable rate limits.
- **The narrative sections aren't a lookup**: sections like "overnight
  sentiment" and "today's option-trade read" are a synthesis job — turning
  raw numbers and headlines into a same-day judgment call. That's a good
  fit for an LLM call (e.g. the Claude API) inside the script, fed the raw
  data your job fetches, rather than something a fixed template can do
  well on its own.

## 4. What I generated for you today

The `market-briefing.html` you received is a one-time snapshot, built from
a round of web research just now (pre-market, 17 Sep 2026 IST) — it is
**not yet wired to regenerate itself**. Treat it as the starting template
and visual design; the automation pieces above are what turn it into a
living daily briefing.
