// Save this file as: scripts/build-briefing.js  in your DrBKMask repo
//
// This is a SKELETON, not a finished scraper. It shows the shape of the job —
// fetch data, fill in the template, write the file — without pretending to
// solve the two hard parts for you:
//   1. Bloomberg, CNBC, and the Economic Times gate most of their content
//      behind paywalls/ToS that forbid automated scraping. Moneycontrol and
//      NSE are more open but still expect you to respect robots.txt and rate
//      limits. Treat every one of these as "read the terms before automating."
//   2. A genuinely good market summary (section 1 and 5 of the dashboard)
//      is a synthesis job, not a lookup — that's the part an LLM call is
//      actually good at. A cron job can gather raw numbers reliably; turning
//      them into "here's what matters and why" each morning is judgment work.
//
// A practical, ToS-friendly setup:
//   - Index levels (Sensex/Nifty/GIFT Nifty/USD-INR/Gold/Crude/US yields):
//     pull from a market-data API you have a legitimate key for (e.g. NSE's
//     own public endpoints for index data, or a paid provider like
//     Alpha Vantage / Twelve Data / a broker's data API).
//   - Headlines: pull structured items from RSS feeds where available
//     (many financial sites publish official RSS/Atom feeds even when the
//     full site is paywalled) rather than scraping rendered HTML.
//   - Narrative synthesis ("what does this mean for today's trade"): send
//     the raw numbers + headlines to the Claude API (see Anthropic's docs)
//     with a prompt asking for exactly the five sections this dashboard
//     uses, and splice the response into the HTML template below.
//
// This script intentionally stops short of hitting any live endpoint so it
// doesn't ship you a scraper that breaks (or breaks ToS) the moment you run
// it unmodified.

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// REAL, WORKING: Finnhub market-status
//
// Free-tier endpoint. Tells you whether a given exchange is open right now —
// it does NOT return prices, index levels, gold, or crude (that's a separate
// problem, see fetchIndexLevels below). Get a free API key at
// https://finnhub.io/register, then set it as a GitHub Actions secret named
// FINNHUB_API_KEY (repo Settings -> Secrets and variables -> Actions).
// ---------------------------------------------------------------------------
async function fetchMarketStatus(exchangeCode) {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    console.warn('FINNHUB_API_KEY not set — skipping market status for', exchangeCode);
    return null;
  }
  const url = `https://finnhub.io/api/v1/stock/market-status?exchange=${exchangeCode}&token=${token}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`Finnhub market-status request failed for ${exchangeCode}: ${res.status}`);
    return null;
  }
  const data = await res.json();
  // Typical shape: { exchange, holiday, isOpen, session, timezone, t }
  return data;
}

function formatStatus(status) {
  if (!status) return 'Status unavailable';
  if (status.holiday) return `Closed — ${status.holiday}`;
  return status.isOpen ? 'Open now' : 'Closed now';
}

async function fetchIndexLevels() {
  // TODO: replace with a real call, e.g.:
  //   const res = await fetch('https://your-data-provider/api/...');
  //   return await res.json();
  return {
    sensex: { value: '—', changePct: '—' },
    nifty: { value: '—', changePct: '—' },
    giftNifty: '—',
    usdInr: '—',
    gold: '—',
    crude: '—',
    us10y: '—',
  };
}

async function fetchHeadlines() {
  // TODO: pull from RSS feeds (e.g. via an `rss-parser` npm package) for
  // Moneycontrol / Economic Times / NSE announcements, and/or a licensed
  // news API for Bloomberg/CNBC-sourced items.
  return [];
}

async function synthesizeNarrative(levels, headlines) {
  // TODO: call the Claude API here with your ANTHROPIC_API_KEY (as a GitHub
  // Actions secret) and a prompt describing the five dashboard sections,
  // passing `levels` and `headlines` as context. Return the generated text
  // blocks keyed by section so buildHtml() can splice them in.
  return {
    overnight: '',
    indices: '',
    stocksToWatch: '',
    commodities: '',
    globalMarkets: '',
  };
}

function buildHtml(template, levels, narrative, marketStatus) {
  let output = template;

  // This part is REAL and working: swap the two Finnhub placeholder markers
  // for live text. Everything else (Sensex/Nifty/gold/crude/narrative) is
  // still a TODO above — see fetchIndexLevels/fetchHeadlines/synthesizeNarrative.
  output = output.replace('<!--FINNHUB_STATUS_US-->—', formatStatus(marketStatus.us));
  output = output.replace('<!--FINNHUB_STATUS_L-->—', formatStatus(marketStatus.london));

  // TODO once you fill in fetchIndexLevels/fetchHeadlines/synthesizeNarrative:
  // add more markers like <!--SENSEX--> in market-briefing.html and replace
  // them here the same way.
  return output;
}

async function main() {
  const templatePath = path.join(__dirname, '..', 'market-briefing.html');
  const template = fs.readFileSync(templatePath, 'utf8');

  const marketStatus = {
    us: await fetchMarketStatus('US'),
    london: await fetchMarketStatus('L'),
  };

  const levels = await fetchIndexLevels();
  const headlines = await fetchHeadlines();
  const narrative = await synthesizeNarrative(levels, headlines);

  const output = buildHtml(template, levels, narrative, marketStatus);
  fs.writeFileSync(templatePath, output, 'utf8');
  console.log('Briefing rebuilt at', new Date().toISOString());
  console.log('Finnhub US status:', marketStatus.us);
  console.log('Finnhub London status:', marketStatus.london);
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
