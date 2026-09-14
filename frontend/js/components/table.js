/**
 * Table & Badge Display Component: Data tables, color badges, risk progress bars.
 */
const STATUS_COLORS = {
  AVAILABLE: "green", RUNNING: "blue", RESERVED: "primary", PAUSED: "yellow", FAULT: "red",
  MAINTENANCE: "yellow", OFFLINE: "gray", DECOMMISSIONED: "gray",
  PENDING_INSPECTION: "yellow", ON_HOLD: "red", REJECTED: "red", DEPLETED: "gray", EXPIRED: "red",
  RELEASED: "green", REWORK_REQUIRED: "yellow", SCRAPPED: "red",
  DRAFT: "gray", SUBMITTED: "yellow", APPROVED: "blue", READY: "primary", COMPLETED: "green",
  DELAYED: "yellow", CANCELLED: "gray",
  SCHEDULED: "primary", MATERIAL_SUBSTITUTION_PENDING: "yellow", PARTIALLY_COMPLETED: "yellow",
  SCRAP_REWORK_REVIEW: "red",
  OPEN: "yellow", UNDER_INVESTIGATION: "blue", ACTION_REQUIRED: "yellow", CORRECTIVE_ACTION: "blue",
  VERIFICATION: "blue", CLOSED: "green", REOPENED: "red",
  NEW: "yellow", ACKNOWLEDGED: "blue", IN_PROGRESS: "blue", RESOLVED: "green", DISMISSED: "gray",
  ACTIVE: "green", INACTIVE: "gray", LOCKED: "red", SUSPENDED: "red",
  PASS: "green", FAIL: "red",
  LOW: "green", MEDIUM: "yellow", HIGH: "red", CRITICAL: "red",
  MINOR: "yellow", MAJOR: "red",
  PENDING: "yellow", REQUESTED: "yellow",
};

function statusBadge(status) {
  const color = STATUS_COLORS[status] || "gray";
  return `<span class="badge badge-${color}">${esc(status || "-")}</span>`;
}

function riskColor(classification) {
  return { LOW: "#1f8a4c", MEDIUM: "#b8860b", HIGH: "#d1373f", CRITICAL: "#8c1c22" }[classification] || "#888";
}

function riskBar(score, classification) {
  const pct = Math.max(2, Math.min(100, score));
  return `<div class="risk-bar-track"><div class="risk-bar-fill" style="width:${pct}%;background:${riskColor(classification)}"></div></div>`;
}

function dataTable(columns, rows, opts = {}) {
  if (!rows || rows.length === 0) {
    return `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>${columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead>
        </table>
        <div class="table-empty">${opts.emptyText || "No records found."}</div>
      </div>`;
  }
  const head = `<tr>${columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr>`;
  const body = rows.map((row) =>
    `<tr>${columns.map((c) => `<td>${c.render ? c.render(row) : esc(row[c.key])}</td>`).join("")}</tr>`
  ).join("");

  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>${head}</thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

window.STATUS_COLORS = STATUS_COLORS;
window.statusBadge = statusBadge;
window.riskColor = riskColor;
window.riskBar = riskBar;
window.dataTable = dataTable;
