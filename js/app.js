/**
 * Main application logic for IV Scheduling Status Tracker.
 */

(async function () {
  // Load data
  try {
    const [currentResp, historyResp] = await Promise.all([
      fetch("data/current.json"),
      fetch("data/history.json"),
    ]);

    if (!currentResp.ok) throw new Error("Failed to load current.json");
    currentData = await currentResp.json();
    historyData = historyResp.ok ? await historyResp.json() : [];
  } catch (err) {
    console.error("Failed to load data:", err);
    document.getElementById("last-updated").textContent = "Error loading data";
    return;
  }

  // Set last updated
  document.getElementById("last-updated").textContent =
    currentData.source_last_updated || currentData.scrape_date;

  // Render hero cards
  renderHero(currentData);

  // Populate filters
  populateEmbassyDropdown(currentData, currentCategory);
  renderTable(currentData, currentCategory, "");

  // Event: category change
  document.getElementById("category-select").addEventListener("change", (e) => {
    currentCategory = e.target.value;
    populateEmbassyDropdown(currentData, currentCategory);
    renderTable(currentData, currentCategory, document.getElementById("embassy-search").value);
    // Update detail if embassy selected
    if (currentEmbassy) showDetail(currentEmbassy, currentCategory);
  });

  // Event: embassy search
  document.getElementById("embassy-search").addEventListener("input", (e) => {
    const q = e.target.value;
    filterEmbassyDropdown(q);
    renderTable(currentData, currentCategory, q);
  });

  // Event: embassy select
  document.getElementById("embassy-select").addEventListener("change", (e) => {
    currentEmbassy = e.target.value;
    if (currentEmbassy) {
      showDetail(currentEmbassy, currentCategory);
    } else {
      document.getElementById("detail").classList.add("hidden");
    }
  });

  // Event: table row click
  document.getElementById("embassy-tbody").addEventListener("click", (e) => {
    const row = e.target.closest("tr");
    if (!row || !row.dataset.embassy) return;
    currentEmbassy = row.dataset.embassy;
    document.getElementById("embassy-select").value = currentEmbassy;
    showDetail(currentEmbassy, currentCategory);
  });

  // Event: table header sort
  document.querySelectorAll("#embassy-table th").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      if (sortColumn === col) {
        sortAsc = !sortAsc;
      } else {
        sortColumn = col;
        sortAsc = col === "embassy";
      }
      renderTable(currentData, currentCategory, document.getElementById("embassy-search").value);
    });
  });

  // Hero card clicks
  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => {
      const cat = card.dataset.category;
      document.getElementById("category-select").value = cat;
      currentCategory = cat;
      populateEmbassyDropdown(currentData, currentCategory);
      renderTable(currentData, currentCategory, "");
      document.getElementById("embassy-search").value = "";
    });
  });
})();

/**
 * Render the 3 hero summary cards.
 */
function renderHero(data) {
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const categories = [
    { key: "immediate_relative", prefix: "ir" },
    { key: "family", prefix: "fam" },
    { key: "employment", prefix: "emp" },
  ];

  for (const { key, prefix } of categories) {
    let currentCount = 0;
    let backlogCount = 0;

    for (const entry of data.data) {
      const val = entry[key];
      if (val === null) continue;

      if (val >= currentYM) {
        currentCount++;
      } else {
        backlogCount++;
      }
    }

    document.getElementById(`${prefix}-current`).textContent = currentCount;
    document.getElementById(`${prefix}-backlog`).textContent = backlogCount;
  }
}

/**
 * Show the detail view for a specific embassy + category.
 */
function showDetail(embassy, category) {
  const detail = document.getElementById("detail");
  detail.classList.remove("hidden");

  document.getElementById("detail-title").textContent =
    `${embassy} — ${CATEGORY_LABELS[category]}`;

  const entry = currentData.data.find(d => d.embassy === embassy);
  const schedDate = entry ? parseYearMonth(entry[category]) : null;

  // Scheduling date
  document.getElementById("detail-date").textContent =
    schedDate ? formatDateDisplay(schedDate) : "N/A";

  // Months behind
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const behind = schedDate ? monthsBetween(schedDate, currentMonth) : null;
  const behindEl = document.getElementById("detail-behind");
  if (behind === null) {
    behindEl.textContent = "N/A";
    behindEl.style.color = "";
  } else if (behind <= 0) {
    behindEl.textContent = "Current";
    behindEl.style.color = "#27ae60";
  } else {
    behindEl.textContent = `${behind} months`;
    behindEl.style.color = behind > 24 ? "#c0392b" : behind > 12 ? "#e67e22" : "";
  }

  // Rate of progress
  const progress = calculateProgress(embassy, category, historyData);
  const rateEl = document.getElementById("detail-rate");
  if (!progress) {
    rateEl.textContent = "Insufficient data";
    rateEl.style.color = "#888";
  } else if (progress.rate > 1.1) {
    rateEl.textContent = `+${progress.rate} mo/mo (catching up)`;
    rateEl.style.color = "#27ae60";
  } else if (progress.rate >= 0.9) {
    rateEl.textContent = `${progress.rate} mo/mo (keeping pace)`;
    rateEl.style.color = "#2563eb";
  } else {
    rateEl.textContent = `${progress.rate} mo/mo (falling behind)`;
    rateEl.style.color = "#c0392b";
  }

  // Render trend chart
  renderTrendChart(embassy, category, historyData);

  // Scroll to detail
  detail.scrollIntoView({ behavior: "smooth", block: "start" });
}
