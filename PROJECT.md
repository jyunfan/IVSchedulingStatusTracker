# PROJECT.md — IV Scheduling Status Tracker (Internal Dev Doc)

## Architecture Overview

Static site + GitHub Actions scraper, hosted on GitHub Pages. No backend server.

**Data source:** [NVC IV Wait Times](https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/iv-wait-times.html)
- HTML table with ~170 embassies
- 3 visa category columns: Employment-Based, Family-Sponsored Preference, Immediate Relative
- Dates in `Mon-YYYY` format; updated approximately weekly by the State Department

## File Structure

```
IVTracker/
├── index.html                    # Dashboard (GitHub Pages root)
├── css/style.css                 # Responsive dashboard styles
├── js/
│   ├── app.js                    # Data loading, hero section, event wiring
│   ├── charts.js                 # Chart.js trend visualization
│   └── filters.js                # Dropdowns, table rendering, filtering
├── data/
│   ├── current.json              # Latest snapshot (loaded first for fast render)
│   └── history.json              # All historical snapshots (lazy-loaded for charts)
├── scraper/
│   └── scrape.py                 # Python scraper
├── .github/workflows/
│   └── scrape.yml                # Daily cron job (noon UTC)
├── requirements.txt              # Python: requests, beautifulsoup4
├── README.md                     # Public-facing documentation
└── PROJECT.md                    # This file
```

## Data Schema

### current.json

```json
{
  "scrape_date": "2026-03-16",
  "source_last_updated": "March 04, 2026",
  "data": [
    {
      "embassy": "Abu Dhabi",
      "employment": "2024-09",
      "family": "2026-03",
      "immediate_relative": "2025-03"
    }
  ]
}
```

### history.json

Array of snapshots with the same structure as `current.json`. Only appends a new entry when `source_last_updated` changes (the State Department updates ~weekly, so this avoids duplicate daily entries).

**Date format:** Normalized from source `Mon-YYYY` to `YYYY-MM` (e.g., `Sep-2024` → `2024-09`). `N/A` values stored as `null`.

**Growth estimate:** ~14KB per snapshot × ~52 updates/year ≈ 0.7MB/year. At scale, split into per-year files if needed.

## Running the Scraper Locally

```bash
pip install -r requirements.txt
python scraper/scrape.py
```

This writes/updates `data/current.json` and `data/history.json`.

## GitHub Actions

The workflow at `.github/workflows/scrape.yml` runs daily at noon UTC:

1. Checks out the repo
2. Installs Python + dependencies
3. Runs `scraper/scrape.py`
4. Commits and pushes updated data files (only if data changed)

**Manual trigger:** Use `workflow_dispatch` from the Actions tab for testing.

**Required permission:** The workflow needs `contents: write` to push commits.

## Frontend

No build step. Vanilla HTML/CSS/JS with CDN-loaded libraries:

- **Chart.js 4.x** — trend visualization
- **chartjs-adapter-date-fns** — date axis support

Dashboard sections:
1. **Hero** — 3 cards showing current/backlogged embassy counts per visa category
2. **Filters** — Visa category → Embassy (searchable dropdown)
3. **Detail view** — Scheduling date, months behind, rate of progress, trend chart
4. **Embassy table** — Sortable by backlog severity

## Deployment

GitHub Pages serves from the repo root. No build or copy step needed.

1. Go to repo Settings → Pages → Source: Deploy from branch → `main` / `/ (root)`
2. Site available at `https://<username>.github.io/IVTracker/`

## Troubleshooting

### Scraper fails
- The HTML table structure on travel.state.gov may change. Check the page manually and update the BeautifulSoup selectors in `scrape.py`.
- GitHub Actions will show the failure in the Actions tab. Enable email notifications for workflow failures.

### Data gaps
- If the Action fails for a period, there will be gaps in `history.json`. The frontend charts handle gaps gracefully (Chart.js skips missing points).

### Large history.json
- If the file grows too large for GitHub Pages to serve efficiently, split into yearly files (`history-2026.json`, etc.) and update `app.js` to load the relevant range.
