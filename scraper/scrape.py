#!/usr/bin/env python3
"""Scrape NVC Immigrant Visa scheduling dates from travel.state.gov."""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

URL = "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/iv-wait-times.html"
USER_AGENT = "IVTracker/1.0 (GitHub Pages project; automated daily scrape)"

MONTHS = {
    "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04",
    "May": "05", "Jun": "06", "Jul": "07", "Aug": "08",
    "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12",
}

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def normalize_date(raw: str) -> str | None:
    """Convert 'Mon-YYYY' to 'YYYY-MM'. Returns None for N/A or invalid."""
    raw = raw.strip()
    if not raw or raw.upper() == "N/A":
        return None
    match = re.match(r"^([A-Za-z]{3})-(\d{4})$", raw)
    if not match:
        print(f"  Warning: unexpected date format '{raw}'", file=sys.stderr)
        return None
    month_abbr, year = match.groups()
    month_num = MONTHS.get(month_abbr.capitalize())
    if not month_num:
        print(f"  Warning: unknown month '{month_abbr}'", file=sys.stderr)
        return None
    return f"{year}-{month_num}"


def scrape() -> dict:
    """Fetch and parse the NVC IV wait times page."""
    print(f"Fetching {URL}")
    resp = requests.get(URL, headers={"User-Agent": USER_AGENT}, timeout=30)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    # Find the main data table
    table = soup.find("table")
    if not table:
        raise RuntimeError("Could not find data table on page")

    rows = table.find_all("tr")
    if len(rows) < 2:
        raise RuntimeError(f"Table has only {len(rows)} rows, expected 170+")

    # Parse header to identify columns
    header_cells = rows[0].find_all(["th", "td"])
    headers = [cell.get_text(strip=True).lower() for cell in header_cells]
    print(f"  Table headers: {headers}")

    # Parse data rows
    data = []
    for row in rows[1:]:
        cells = row.find_all(["td", "th"])
        if len(cells) < 4:
            continue
        texts = [cell.get_text(strip=True) for cell in cells]
        embassy = texts[0]
        if not embassy or embassy.lower() in ("post", "embassy", "consulate"):
            continue
        entry = {
            "embassy": embassy,
            "employment": normalize_date(texts[1]),
            "family": normalize_date(texts[2]),
            "immediate_relative": normalize_date(texts[3]),
        }
        data.append(entry)

    print(f"  Parsed {len(data)} embassies")
    if len(data) < 50:
        raise RuntimeError(f"Only parsed {len(data)} embassies, expected 150+. Page structure may have changed.")

    # Extract "Last Updated" text
    source_last_updated = None
    for text in soup.stripped_strings:
        if "last updated" in text.lower():
            source_last_updated = text
            break
    # Try to extract just the date portion
    if source_last_updated:
        match = re.search(r"(\w+ \d{1,2},? \d{4})", source_last_updated)
        if match:
            source_last_updated = match.group(1)
    print(f"  Source last updated: {source_last_updated}")

    snapshot = {
        "scrape_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "source_last_updated": source_last_updated,
        "data": data,
    }
    return snapshot


def save(snapshot: dict) -> None:
    """Write current.json and append to history.json if source data changed."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    current_path = DATA_DIR / "current.json"
    history_path = DATA_DIR / "history.json"

    # Write current.json
    with open(current_path, "w") as f:
        json.dump(snapshot, f, indent=2)
    print(f"  Wrote {current_path}")

    # Load existing history
    history = []
    if history_path.exists():
        with open(history_path) as f:
            history = json.load(f)

    # Only append if source_last_updated is new
    if history:
        last_updated = history[0].get("source_last_updated")
        if last_updated == snapshot["source_last_updated"]:
            print(f"  Source unchanged ({last_updated}), skipping history append")
            return

    # Prepend new snapshot (newest first)
    history.insert(0, snapshot)
    with open(history_path, "w") as f:
        json.dump(history, f, indent=2)
    print(f"  Appended to {history_path} (now {len(history)} snapshots)")


def main():
    try:
        snapshot = scrape()
        save(snapshot)
        print("Done.")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
