/**
 * Filter and table logic for IV Scheduling Status Tracker.
 */

let currentData = null;
let historyData = null;
let currentCategory = "immediate_relative";
let currentEmbassy = "";
let sortColumn = "behind";
let sortAsc = false;

const CATEGORY_LABELS = {
  immediate_relative: "Immediate Relative",
  family: "Family-Sponsored Preference",
  employment: "Employment-Based Preference",
};

/**
 * Populate the embassy dropdown from current data.
 */
function populateEmbassyDropdown(data, category) {
  const select = document.getElementById("embassy-select");
  const current = select.value;
  select.innerHTML = '<option value="">All Embassies</option>';

  const embassies = data.data
    .filter(d => d[category] !== null)
    .sort((a, b) => a.embassy.localeCompare(b.embassy));

  for (const entry of embassies) {
    const opt = document.createElement("option");
    opt.value = entry.embassy;
    opt.textContent = `${entry.embassy} — ${entry[category] || "N/A"}`;
    select.appendChild(opt);
  }

  // Restore selection if still valid
  if (current && [...select.options].some(o => o.value === current)) {
    select.value = current;
  }
}

/**
 * Filter embassy dropdown options based on search input.
 */
function filterEmbassyDropdown(searchText) {
  const select = document.getElementById("embassy-select");
  const options = select.querySelectorAll("option");
  const query = searchText.toLowerCase();

  for (const opt of options) {
    if (opt.value === "") {
      opt.hidden = false;
      continue;
    }
    opt.hidden = !opt.textContent.toLowerCase().includes(query);
  }
}

/**
 * Render the embassy table for the selected category.
 */
function renderTable(data, category, searchFilter) {
  const tbody = document.getElementById("embassy-tbody");
  const label = document.getElementById("table-category-label");
  label.textContent = CATEGORY_LABELS[category];

  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let rows = data.data.map(entry => {
    const schedDate = parseYearMonth(entry[category]);
    const behind = schedDate ? monthsBetween(schedDate, currentMonth) : null;
    return {
      embassy: entry.embassy,
      date: entry[category],
      schedDate,
      behind: behind !== null ? Math.max(0, behind) : null,
    };
  });

  // Apply search filter
  if (searchFilter) {
    const q = searchFilter.toLowerCase();
    rows = rows.filter(r => r.embassy.toLowerCase().includes(q));
  }

  // Sort
  rows.sort((a, b) => {
    let cmp = 0;
    if (sortColumn === "embassy") {
      cmp = a.embassy.localeCompare(b.embassy);
    } else if (sortColumn === "date") {
      const da = a.schedDate || new Date(0);
      const db = b.schedDate || new Date(0);
      cmp = da - db;
    } else {
      const ba = a.behind ?? 9999;
      const bb = b.behind ?? 9999;
      cmp = bb - ba; // Default: most backlogged first
    }
    return sortAsc ? cmp : -cmp;
  });

  tbody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.dataset.embassy = row.embassy;

    const tdName = document.createElement("td");
    tdName.textContent = row.embassy;

    const tdDate = document.createElement("td");
    tdDate.textContent = row.date ? formatDateDisplay(row.schedDate) : "N/A";

    const tdBehind = document.createElement("td");
    if (row.behind === null) {
      tdBehind.textContent = "N/A";
    } else if (row.behind === 0) {
      tdBehind.textContent = "Current";
      tdBehind.style.color = "#27ae60";
    } else {
      tdBehind.textContent = `${row.behind} months`;
      if (row.behind > 24) tdBehind.style.color = "#c0392b";
      else if (row.behind > 12) tdBehind.style.color = "#e67e22";
    }

    tr.appendChild(tdName);
    tr.appendChild(tdDate);
    tr.appendChild(tdBehind);
    tbody.appendChild(tr);
  }
}

/**
 * Calculate rate of progress from history data.
 * Compares scheduling date ~30 days ago vs now.
 */
function calculateProgress(embassy, category, history) {
  if (!history || history.length < 2) return null;

  const latest = history[0];
  const latestEntry = latest.data.find(d => d.embassy === embassy);
  if (!latestEntry || !latestEntry[category]) return null;

  // Find snapshot from ~30 days ago
  const latestDate = new Date(latest.scrape_date);
  let older = null;
  for (const snapshot of history) {
    const d = new Date(snapshot.scrape_date);
    if (latestDate - d >= 25 * 24 * 60 * 60 * 1000) {
      older = snapshot;
      break;
    }
  }

  if (!older) {
    // Use the oldest available
    older = history[history.length - 1];
    if (older === latest) return null;
  }

  const olderEntry = older.data.find(d => d.embassy === embassy);
  if (!olderEntry || !olderEntry[category]) return null;

  const newDate = parseYearMonth(latestEntry[category]);
  const oldDate = parseYearMonth(olderEntry[category]);
  if (!newDate || !oldDate) return null;

  const schedAdvance = monthsBetween(oldDate, newDate);
  const realDays = (new Date(latest.scrape_date) - new Date(older.scrape_date)) / (24 * 60 * 60 * 1000);
  const realMonths = realDays / 30.44;

  if (realMonths < 0.5) return null;

  const rate = schedAdvance / realMonths;
  return { schedAdvance, realMonths: Math.round(realMonths * 10) / 10, rate: Math.round(rate * 10) / 10 };
}
