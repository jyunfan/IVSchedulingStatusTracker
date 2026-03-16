/**
 * Chart rendering for IV Scheduling Status Tracker.
 * Uses Chart.js with date-fns adapter.
 */

let trendChart = null;

/**
 * Convert "YYYY-MM" to a Date object (1st of that month).
 */
function parseYearMonth(ym) {
  if (!ym) return null;
  const [year, month] = ym.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

/**
 * Format a Date as "Mon YYYY" for display.
 */
function formatDateDisplay(date) {
  if (!date) return "N/A";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Calculate months between two dates.
 */
function monthsBetween(earlier, later) {
  if (!earlier || !later) return null;
  return (later.getFullYear() - earlier.getFullYear()) * 12
       + (later.getMonth() - earlier.getMonth());
}

/**
 * Render the trend chart for a specific embassy + category.
 *
 * @param {string} embassy - Embassy name
 * @param {string} category - "employment", "family", or "immediate_relative"
 * @param {Array} history - Array of history snapshots (newest first)
 */
function renderTrendChart(embassy, category, history) {
  const ctx = document.getElementById("trend-chart");
  if (!ctx) return;

  // Destroy previous chart
  if (trendChart) {
    trendChart.destroy();
    trendChart = null;
  }

  // Build data points from history (reverse to chronological order)
  const points = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const snapshot = history[i];
    const entry = snapshot.data.find(d => d.embassy === embassy);
    if (!entry) continue;
    const schedDate = parseYearMonth(entry[category]);
    if (!schedDate) continue;
    points.push({
      x: new Date(snapshot.scrape_date),
      y: schedDate,
    });
  }

  if (points.length === 0) {
    ctx.getContext("2d").clearRect(0, 0, ctx.width, ctx.height);
    return;
  }

  // "Current" reference line
  const now = new Date();
  const currentLine = new Date(now.getFullYear(), now.getMonth(), 1);

  trendChart = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Scheduling Date",
          data: points,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.1)",
          fill: true,
          tension: 0.2,
          pointRadius: 3,
        },
        {
          label: "Current Month",
          data: points.map(p => ({ x: p.x, y: currentLine })),
          borderColor: "#ccc",
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      scales: {
        x: {
          type: "time",
          time: {
            unit: "week",
            tooltipFormat: "MMM d, yyyy",
          },
          title: { display: true, text: "Date Scraped" },
        },
        y: {
          type: "time",
          time: {
            unit: "month",
            tooltipFormat: "MMM yyyy",
          },
          title: { display: true, text: "Scheduling Date" },
        },
      },
      plugins: {
        legend: { display: true, position: "top" },
      },
    },
  });
}
