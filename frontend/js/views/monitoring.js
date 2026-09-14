/**
 * Monitoring View Component: Live Production floor tracking,
 * active alerts, risk scores, incidents, and overrides.
 */
var Views = window.Views || {};

Views.monitoring = Object.assign(Views.monitoring || {}, {
  async live() {
    const [runsResp, machinesResp, operatorsResp, batchesResp, dashResp] = await Promise.all([
      Api.get("/v1/runs?status_=RUNNING"),
      Api.get("/v1/machines"),
      Api.get("/v1/operators"),
      Api.get("/v1/batches"),
      Api.get("/v1/dashboard"),
    ]);
    const content = document.getElementById("content");
    const runningMachines = machinesResp.items.filter((m) => m.status === "RUNNING");
    const activeBatches = batchesResp.items.filter((b) => ["AVAILABLE", "ON_HOLD", "RESERVED", "IN_USE"].includes(b.status));
    const bottlenecks = dashResp.developingBottlenecks || [];

    content.innerHTML = `
      <div class="page-header"><h2>Live Production &amp; Resource Status</h2></div>
      <p class="flow-note">Real-time status tracking for Machines, Active Production Runs, Operators, and Material Batches.</p>
      ${bottlenecks.length ? `
        <div class="line-stop-banner" style="margin-bottom:20px;padding:16px 20px;background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.3);border-left:5px solid var(--danger);border-radius:var(--radius-md)">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:22px">&#9888;&#65039;</span>
              <div>
                <h3 style="margin:0;color:var(--danger);font-size:15px;font-weight:700">Active Line-Stop Risk / Developing Bottleneck</h3>
                <p style="margin:2px 0 0 0;font-size:13px;color:var(--text)">Floor supervisor alert -- resources impacted by holds or overdue orders:</p>
              </div>
            </div>
            <span class="badge badge-red">${bottlenecks.length} Active Bottleneck${bottlenecks.length > 1 ? 's' : ''}</span>
          </div>
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:10px">
            ${bottlenecks.map((b) => `
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
      <div class="grid-2">
        <div class="card">
          <h3>Running Machines (${runningMachines.length})</h3>
          ${dataTable([
            { label: "Machine", key: "name" },
            { label: "Location", key: "location" },
            { label: "Status", render: (m) => `${statusBadge(m.status)} ${m.isStale ? '<span class="badge badge-yellow">STALE</span>' : ""}` },
            { label: "Last Heartbeat", render: (m) => timeAgo(m.lastHeartbeatAt) },
          ], runningMachines, { emptyText: "No machines currently running." })}
        </div>
        <div class="card">
          <h3>Active Production Runs (${runsResp.items.length})</h3>
          ${dataTable([
            { label: "Run", render: (r) => `<strong>${esc(r.code)}</strong>` },
            { label: "Order", key: "orderCode" },
            { label: "Machine", key: "machineName" },
            { label: "Operator", render: (r) => esc(r.operatorName || "-") },
            { label: "Materials", render: (r) => esc(r.materialsSummary || "-") },
            { label: "Status", render: (r) => `${statusBadge(r.status)} ${r.isStale ? '<span class="badge badge-yellow">STALE</span>' : ""}` },
          ], runsResp.items, { emptyText: "No active runs." })}
        </div>
      </div>
      <div class="grid-2" style="margin-top:16px">
        <div class="card">
          <h3>Live Operator Status (${operatorsResp.items.length})</h3>
          ${dataTable([
            { label: "Operator", key: "name" },
            { label: "Code", key: "employeeCode" },
            { label: "Shift", key: "shiftPattern" },
            { label: "Status", render: (o) => {
              if (o.liveStatus === "ASSIGNED") return `<span class="badge badge-green">RUNNING (${esc(o.activeRunCode)} on ${esc(o.activeMachineName || 'Mach')})</span>`;
              if (o.liveStatus === "SCHEDULED") return `<span class="badge badge-blue">SCHEDULED (${esc(o.activeRunCode)})</span>`;
              return `<span class="badge badge-gray">AVAILABLE (IDLE)</span>`;
            }},
          ], operatorsResp.items, { emptyText: "No operators registered." })}
        </div>
        <div class="card">
          <h3>Material Batches &amp; Hold Status</h3>
          ${dataTable([
            { label: "Lot Number", render: (b) => `<strong>${esc(b.lotNumber)}</strong>` },
            { label: "Material", key: "materialName" },
            { label: "Available", render: (b) => `${fmtNum(b.availableQuantity)} ${esc(b.unitOfMeasure || '')}` },
            { label: "Reserved", render: (b) => `${fmtNum(b.reservedQuantity)}` },
            { label: "Status", render: (b) => statusBadge(b.status) },
          ], activeBatches, { emptyText: "No active material batches." })}
        </div>
      </div>
    `;

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

  // ---------------- Alerts (Sections 33-34) ----------------
  async alerts() {
    const d = await Api.get("/v1/alerts");
    const canManage = Auth.hasPerm("MANAGE_ALERTS");
    const content = document.getElementById("content");
    const openAlerts = d.items.filter((a) => !["RESOLVED", "DISMISSED"].includes(a.status));
    const closedAlerts = d.items.filter((a) => ["RESOLVED", "DISMISSED"].includes(a.status));
    content.innerHTML = `
      <div class="page-header"><h2>Alerts</h2></div>
      <div class="card"><h3>Active (${openAlerts.length})</h3>
        ${dataTable([
          { label: "Severity", render: (a) => statusBadge(a.severity) }, { label: "Type", key: "type" }, { label: "Message", key: "message" },
          { label: "Status", render: (a) => `${statusBadge(a.status)} ${a.escalated ? '<span class="badge badge-red">ESCALATED</span>' : ""}` },
          { label: "SLA Due", render: (a) => fmtDate(a.slaDueAt) }, { label: "Created", render: (a) => timeAgo(a.createdAt) },
          { label: "", render: (a) => canManage ? this.alertActions(a) : "" },
        ], openAlerts, { emptyText: "No active alerts." })}
      </div>
      <div class="card"><h3>Resolved / Dismissed</h3>
        ${dataTable([
          { label: "Severity", render: (a) => statusBadge(a.severity) }, { label: "Type", key: "type" }, { label: "Message", key: "message" },
          { label: "Status", render: (a) => statusBadge(a.status) }, { label: "Created", render: (a) => fmtDate(a.createdAt) },
        ], closedAlerts.slice(0, 20), { emptyText: "None yet." })}
      </div>
    `;
    if (canManage) content.querySelectorAll("[data-alert-act]").forEach((b) => b.addEventListener("click", () => this.alertAction(b.dataset.alertAct, b.dataset.id)));
  },

  alertActions(a) {
    const map = { NEW: [["Acknowledge", "ACKNOWLEDGED"]], ACKNOWLEDGED: [["Start Work", "IN_PROGRESS"], ["Dismiss", "DISMISSED"]], IN_PROGRESS: [["Resolve", "RESOLVED"], ["Dismiss", "DISMISSED"]] };
    return (map[a.status] || []).map(([label, to]) => `<button class="btn btn-sm" data-alert-act="${to}" data-id="${a.id}">${label}</button>`).join(" ");
  },

  async alertAction(toState, id) {
    let reason;
    if (toState === "DISMISSED") reason = prompt("Reason for dismissal?") || "";
    try { await Api.post(`/v1/alerts/${id}/transitions`, { toState, reason }); toast(`Alert -> ${toState}.`, "success"); App.route(); }
    catch (err) { notifyError(err); }
  },

  // ---------------- Risks (Section 36) ----------------
  async risks() {
    const d = await Api.get("/v1/risk-scores");
    const content = document.getElementById("content");
    const sorted = d.items.sort((a, b) => b.score - a.score);
    content.innerHTML = `
      <div class="page-header"><h2>Risk Scores</h2></div>
      <p class="flow-note">Section 36.1: within a category (Schedule, Resource, Machine Health, Quality) only the worst active factor counts; categories then sum, capped at 100.</p>
      <div class="card">${dataTable([
        { label: "Entity", render: (r) => `${r.entityType} / ${r.entityId.slice(0, 8)}` },
        { label: "Score", render: (r) => `<div style="width:140px">${riskBar(r.score, r.classification)}</div>` },
        { label: "Classification", render: (r) => statusBadge(r.classification) },
        { label: "Contributing Factors", render: (r) => r.contributingFactors.map((f) => `<span class="badge badge-gray" style="margin-right:4px">${esc(f.factorCode)} (+${f.score})</span>`).join("") || "-" },
        { label: "Calculated", render: (r) => timeAgo(r.calculatedAt) },
      ], sorted, { emptyText: "No risk scores calculated yet." })}</div>
    `;
  },

  // ---------------- Incidents (Sections 31-32) ----------------
  INCIDENT_TRANSITIONS: {
    OPEN: ["UNDER_INVESTIGATION", "CLOSED"], UNDER_INVESTIGATION: ["ACTION_REQUIRED", "CLOSED"],
    ACTION_REQUIRED: ["CORRECTIVE_ACTION"], CORRECTIVE_ACTION: ["VERIFICATION"],
    VERIFICATION: ["CLOSED", "UNDER_INVESTIGATION"], CLOSED: ["REOPENED"], REOPENED: ["UNDER_INVESTIGATION"],
  },

  async incidents() {
    const d = await Api.get("/v1/incidents");
    const canManage = Auth.hasPerm("MANAGE_INCIDENTS");
    const canReport = Auth.hasPerm("MANAGE_INCIDENTS", "REPORT_INCIDENTS");
    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="page-header"><h2>Incidents</h2><div class="page-actions">${canReport ? `<button class="btn btn-primary" id="new-incident-btn">+ Report Incident</button>` : ""}</div></div>
      <div class="card">${dataTable([
        { label: "Code", key: "code" }, { label: "Type", key: "type" }, { label: "Severity", render: (i) => statusBadge(i.severity) },
        { label: "Status", render: (i) => statusBadge(i.status) }, { label: "Detected", render: (i) => fmtDate(i.detectedAt) },
        { label: "Description", key: "description" },
        { label: "", render: (i) => canManage ? `<button class="btn btn-sm" data-incident="${i.id}">Manage</button>` : "" },
      ], d.items, { emptyText: "No incidents." })}</div>
    `;
    if (canReport) document.getElementById("new-incident-btn").addEventListener("click", () => this.newIncidentModal());
    if (canManage) content.querySelectorAll("[data-incident]").forEach((b) => b.addEventListener("click", () => this.openIncidentModal(b.dataset.incident, d.items)));
  },

  newIncidentModal() {
    openModal({
      title: "Report Incident",
      bodyHtml: `<form id="inc-form"><div class="form-grid">
        <div class="field"><label>Type</label><input name="type" required /></div>
        <div class="field"><label>Severity</label><select name="severity"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></div>
        <div class="field span-2"><label>Description</label><textarea name="description" required></textarea></div>
      </div></form>`,
      footerHtml: `<button class="btn" id="cancel-btn">Cancel</button><button class="btn btn-primary" id="save-btn">Submit</button>`,
      onMount: () => {
        document.getElementById("cancel-btn").onclick = closeModal;
        document.getElementById("save-btn").onclick = async () => {
          try { await Api.post("/v1/incidents", formToObject(document.getElementById("inc-form"))); closeModal(); toast("Incident reported.", "success"); App.route(); }
          catch (err) { notifyError(err); }
        };
      },
    });
  },

  openIncidentModal(id, items) {
    const inc = items.find((i) => i.id === id);
    const legal = this.INCIDENT_TRANSITIONS[inc.status] || [];
    openModal({
      title: `${inc.code} -- ${inc.status}`,
      bodyHtml: `
        <dl class="kv-list"><dt>Type</dt><dd>${esc(inc.type)}</dd><dt>Severity</dt><dd>${statusBadge(inc.severity)}</dd><dt>Description</dt><dd>${esc(inc.description || "")}</dd></dl>
        ${legal.length ? `<div class="section-divider">Transition</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <select id="inc-select">${legal.map((s) => `<option value="${s}">${s}</option>`).join("")}</select>
          <input id="inc-reason" placeholder="reason (required for CLOSED)" style="flex:1;min-width:160px;padding:6px;border:1px solid var(--border);border-radius:6px" />
          <button class="btn btn-primary btn-sm" id="inc-apply">Apply</button>
        </div>` : ""}
      `,
      footerHtml: `<button class="btn" id="close-btn">Close</button>`,
      onMount: () => {
        document.getElementById("close-btn").onclick = closeModal;
        const apply = document.getElementById("inc-apply");
        if (apply) apply.onclick = async () => {
          const toState = document.getElementById("inc-select").value;
          const reason = document.getElementById("inc-reason").value;
          try { await Api.post(`/v1/incidents/${id}/transitions`, { toState, reason }); toast(`Incident -> ${toState}.`, "success"); closeModal(); App.route(); }
          catch (err) { notifyError(err); }
        };
      },
    });
  },

  // ---------------- Overrides (Section 27) ----------------
  async overrides() {
    const d = await Api.get("/v1/overrides");
    const canRequest = Auth.hasPerm("CREATE_OVERRIDE");
    const canApprove = Auth.hasPerm("APPROVE_OVERRIDE");
    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="page-header"><h2>Overrides</h2><div class="page-actions">${canRequest ? `<button class="btn btn-primary" id="new-override-btn">+ Request Override</button>` : ""}</div></div>
      <p class="flow-note">Every override is a first-class, audited record linked to its own AuditLog entry (Section 27) -- never a silently bypassed check.</p>
      <div class="card">${dataTable([
        { label: "Conflict Type", key: "conflictType" }, { label: "Entity", render: (o) => `${o.entityType} / ${(o.entityId || "").slice(0, 8)}` },
        { label: "Reason", key: "reason" }, { label: "Status", render: (o) => statusBadge(o.status) }, { label: "Requested", render: (o) => fmtDate(o.timestamp) },
        { label: "", render: (o) => canApprove && o.status === "PENDING" ? `<button class="btn btn-sm" data-approve="${o.id}">Approve</button> <button class="btn btn-sm" data-reject="${o.id}">Reject</button>` : "" },
      ], d.items, { emptyText: "No overrides requested." })}</div>
    `;
    if (canRequest) document.getElementById("new-override-btn").addEventListener("click", () => this.newOverrideModal());
    if (canApprove) {
      content.querySelectorAll("[data-approve]").forEach((b) => b.addEventListener("click", async () => { try { await Api.post(`/v1/overrides/${b.dataset.approve}/approve`, { reason: prompt("Approval note?") || "" }); toast("Override approved.", "success"); App.route(); } catch (e) { notifyError(e); } }));
      content.querySelectorAll("[data-reject]").forEach((b) => b.addEventListener("click", async () => { try { await Api.post(`/v1/overrides/${b.dataset.reject}/reject`, { reason: prompt("Rejection reason?") || "" }); toast("Override rejected.", "success"); App.route(); } catch (e) { notifyError(e); } }));
    }
  },

  newOverrideModal() {
    openModal({
      title: "Request Override",
      bodyHtml: `<form id="ov-form"><div class="form-grid cols-1">
        <div class="field"><label>Conflict Type</label><input name="conflictType" placeholder="e.g. RESOURCE_CONFLICT" required /></div>
        <div class="field"><label>Entity Type</label><input name="entityType" placeholder="e.g. PRODUCTION_ORDER" required /></div>
        <div class="field"><label>Entity ID</label><input name="entityId" required /></div>
        <div class="field"><label>Reason</label><input name="reason" required /></div>
        <div class="field"><label>Justification</label><textarea name="justification" required></textarea></div>
      </div></form>`,
      footerHtml: `<button class="btn" id="cancel-btn">Cancel</button><button class="btn btn-primary" id="save-btn">Submit</button>`,
      onMount: () => {
        document.getElementById("cancel-btn").onclick = closeModal;
        document.getElementById("save-btn").onclick = async () => {
          try { await Api.post("/v1/overrides", formToObject(document.getElementById("ov-form"))); closeModal(); toast("Override requested.", "success"); App.route(); }
          catch (err) { notifyError(err); }
        };
      },
    });
  },
});

window.Views = Views;
