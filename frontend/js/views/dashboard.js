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
        <div>
          <h2>Operational Dashboard</h2>
          <p class="muted" style="margin: 4px 0 0 0; font-size: 13px;">Real-time system throughput, plant line status, and active alerts</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" id="refresh-dash">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            Refresh Metrics
          </button>
        </div>
      </div>
      ${d.developingBottlenecks && d.developingBottlenecks.length ? `
        <div class="line-stop-banner" style="margin-bottom:20px;padding:16px 20px;background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.3);border-left:5px solid var(--danger);border-radius:var(--radius-md)">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:22px">&#9888;&#65039;</span>
              <div>
                <h3 style="margin:0;color:var(--danger);font-size:15px;font-weight:700">Active Line-Stop Risk / Developing Bottleneck</h3>
                <p style="margin:2px 0 0 0;font-size:13px;color:var(--text)">Immediate attention required to prevent production line halt:</p>
              </div>
            </div>
            <span class="badge badge-red">${d.developingBottlenecks.length} Impacted Run${d.developingBottlenecks.length > 1 ? 's' : ''}</span>
          </div>
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:10px">
            ${d.developingBottlenecks.map((b) => `
              <div style="background:var(--surface);padding:12px 14px;border-radius:var(--radius-sm);border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
                <div>
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <strong>Run ${esc(b.runCode)}</strong> ${statusBadge(b.runStatus)}
                    &bull; Machine: <strong>${esc(b.machineName || 'None')}</strong> ${b.machineStatus ? statusBadge(b.machineStatus) : ''}
                    &bull; Operator: <strong>${esc(b.operatorName || 'Unassigned')}${b.operatorCode ? ` (${esc(b.operatorCode)})` : ''}</strong>
                    ${b.orderCode ? `&bull; Order: <strong>${esc(b.orderCode)}</strong> (${esc(b.productName || '')}) ${b.isOverdue ? '<span class="badge badge-red">OVERDUE</span>' : ''}` : ''}
                  </div>
                  ${b.heldBatches && b.heldBatches.length ? `
                    <div style="margin-top:6px;font-size:13px;color:var(--danger)">
                      <strong>Root Cause:</strong> Material Lot <strong>${b.heldBatches.map(hb => esc(hb.lotNumber)).join(', ')}</strong> (${b.heldBatches.map(hb => esc(hb.materialName)).join(', ')}) is <span class="badge badge-red">ON_HOLD</span> (${b.heldBatches.reduce((acc, x) => acc + x.quantityReserved, 0)} reserved)
                    </div>
                  ` : ''}
                </div>
                <div>
                  <button class="btn btn-sm btn-primary" data-trace-jump-type="${esc(b.rootCauseType)}" data-trace-jump-id="${esc(b.rootCauseId)}">
                    Diagnose in Traceability Explorer &rarr;
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
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
            <div style="padding:10px 0;border-bottom:1px solid var(--border-subtle)">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
                <span class="badge badge-red">[!] ${esc(a.type)}</span>
              </div>
              <span class="muted" style="font-size:13px">${esc(a.message)}</span>
            </div>`).join("") : `<p class="muted">No critical alerts.</p>`}
        </div>
        <div class="card">
          <h3>Resource Conflicts</h3>
          ${d.resourceConflicts.length ? d.resourceConflicts.map((c) => `
            <div style="padding:10px 0;border-bottom:1px solid var(--border-subtle);font-size:13px;color:var(--text)">
              ${esc(c.message)}
            </div>`).join("") : `<p class="muted">No recent conflicts.</p>`}
        </div>
      </div>
      ${(d.staleness.machines.length || d.staleness.runs.length) ? `
      <div class="card" style="border-left: 4px solid var(--warning)">
        <h3>Stale Telemetry Feed</h3>
        ${d.staleness.machines.map((m) => `<div style="padding:4px 0;font-size:13px">Machine <strong>${esc(m.name)}</strong> -- no heartbeat since ${fmtDate(m.lastHeartbeatAt)}</div>`).join("")}
        ${d.staleness.runs.map((r) => `<div style="padding:4px 0;font-size:13px">Run <strong>${esc(r.code)}</strong> -- no heartbeat since ${fmtDate(r.lastHeartbeatAt)}</div>`).join("")}
      </div>` : ""}
    `;

    document.getElementById("refresh-dash").addEventListener("click", () => App.route());
    content.querySelectorAll("[data-trace-jump-type]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = btn.dataset.traceJumpType;
        const id = btn.dataset.traceJumpId;
        if (Views.traceability && Views.traceability.openTraceModal) {
          Views.traceability.openTraceModal(t, id);
        } else {
          window.location.hash = "#/traceability";
        }
      });
    });
  },

  statusBars(counts) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts).map(([k, v]) => `
      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px">
          <span>${statusBadge(k)}</span><span class="muted" style="font-family:var(--font-mono);font-size:12px;font-weight:600">${v} (${Math.round((v / total) * 100)}%)</span>
        </div>
        <div class="risk-bar-track"><div class="risk-bar-fill" style="width:${(v / total) * 100}%;background:var(--primary)"></div></div>
      </div>`).join("") || `<p class="muted">No data.</p>`;
  },
};

window.Views = Views;
