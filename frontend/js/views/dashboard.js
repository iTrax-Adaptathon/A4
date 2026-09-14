/**
 * Dashboard View Component: KPI metrics, line health, resource conflict feeds,
 * and machine/run staleness monitoring.
 */
var Views = window.Views || {};

Views.dashboard = {
  async render() {
    const d = await Api.get("/v1/dashboard");
    const content = document.getElementById("content");
    const k = d.kpis;
    const kpiCard = (label, value, accent) => `
      <div class="kpi-card ${accent ? "accent-" + accent : ""}">
        <div class="kpi-value">${value}</div>
        <div class="kpi-label">${esc(label)}</div>
      </div>`;

    content.innerHTML = `
      <div class="page-header">
        <h2>Dashboard</h2>
        <div class="page-actions"><button class="btn" id="refresh-dash">Refresh</button></div>
      </div>
      <div class="kpi-grid">
        ${kpiCard("Active Orders", k.activeOrders)}
        ${kpiCard("Running Machines", k.runningMachines, "info")}
        ${kpiCard("Available Machines", k.availableMachines, "success")}
        ${kpiCard("Material Holds", k.materialHolds, "warning")}
        ${kpiCard("Quality Holds", k.qualityHolds, "warning")}
        ${kpiCard("Critical Alerts", k.criticalAlerts, "danger")}
        ${kpiCard("Delayed Orders", k.delayedOrders, "warning")}
        ${kpiCard("Open Incidents", k.openIncidents, "danger")}
      </div>
      <div class="grid-2">
        <div class="card">
          <h3>Production Status</h3>
          ${this.statusBars(d.productionStatus)}
        </div>
        <div class="card">
          <h3>Machine Status</h3>
          ${this.statusBars(d.machineStatus)}
        </div>
      </div>
      <div class="grid-2">
        <div class="card">
          <h3>Critical Alerts</h3>
          ${d.criticalAlertsList.length ? d.criticalAlertsList.map((a) => `
            <div style="padding:8px 0;border-bottom:1px solid #f0f1f4">
              <strong>[!] ${esc(a.type)}</strong><br/>
              <span class="muted">${esc(a.message)}</span>
            </div>`).join("") : `<p class="muted">No critical alerts.</p>`}
        </div>
        <div class="card">
          <h3>Resource Conflicts</h3>
          ${d.resourceConflicts.length ? d.resourceConflicts.map((c) => `
            <div style="padding:8px 0;border-bottom:1px solid #f0f1f4">${esc(c.message)}</div>`).join("") : `<p class="muted">No recent conflicts.</p>`}
        </div>
      </div>
      ${(d.staleness.machines.length || d.staleness.runs.length) ? `
      <div class="card">
        <h3>Stale Data (Section 35.2)</h3>
        ${d.staleness.machines.map((m) => `<div>Machine <strong>${esc(m.name)}</strong> -- no update since ${fmtDate(m.lastHeartbeatAt)}</div>`).join("")}
        ${d.staleness.runs.map((r) => `<div>Run <strong>${esc(r.code)}</strong> -- no update since ${fmtDate(r.lastHeartbeatAt)}</div>`).join("")}
      </div>` : ""}
    `;

    document.getElementById("refresh-dash").addEventListener("click", () => App.route());
  },

  statusBars(counts) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts).map(([k, v]) => `
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
          <span>${statusBadge(k)}</span><span class="muted">${v}</span>
        </div>
        <div class="risk-bar-track"><div class="risk-bar-fill" style="width:${(v / total) * 100}%;background:var(--primary)"></div></div>
      </div>`).join("") || `<p class="muted">No data.</p>`;
  },
};

window.Views = Views;
