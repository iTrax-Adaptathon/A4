/**
 * Traceability View Component: Traceability Explorer, lookup search,
 * backward genealogy, forward recall, and root-cause event timeline.
 */
var Views = window.Views || {};

Views.traceability = {
  async traceability() {
    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="page-header"><h2>Traceability Explorer</h2></div>
      <div class="card">
        <h3>Find a record</h3>
        <p class="flow-note">Search by a familiar reference, such as <strong>PO-100</strong>, <strong>PR-201</strong>, <strong>PB-201</strong>, <strong>MB-001</strong>, or <strong>M-03</strong>. Then choose a result to inspect its genealogy &amp; timeline.</p>
        <form id="trace-search-form" class="trace-search-form">
          <input id="trace-query" placeholder="Search order, run, batch, machine, defect, or incident" autocomplete="off" />
          <button class="btn btn-primary" type="submit">Search</button>
        </form>
      </div>
      <div id="trace-search-results"></div>
      <div id="trace-output"></div>
    `;
    content.querySelector("#trace-search-form").addEventListener("submit", (event) => {
      event.preventDefault();
      void this.searchTrace(content.querySelector("#trace-query").value);
    });
  },

  async openTraceModal(type, id) {
    if (window.App && window.App.navigate) {
      window.App.navigate("traceability");
    }
    setTimeout(async () => {
      await this.runTrace(type, id);
    }, 60);
  },

  async searchTrace(query) {
    const results = document.getElementById("trace-search-results");
    const output = document.getElementById("trace-output");
    const q = query.trim();
    if (output) output.innerHTML = "";
    if (q.length < 2) {
      if (results) results.innerHTML = `<div class="empty-state">Enter at least two characters to search.</div>`;
      return;
    }
    if (results) results.innerHTML = `<div class="empty-state">Searching...</div>`;
    try {
      const d = await Api.get(`/v1/traceability/lookup?q=${encodeURIComponent(q)}`);
      if (!results || !results.isConnected) return;
      results.innerHTML = d.items.length
        ? `<div class="card"><h3>Choose a matching record</h3>${dataTable([
            { label: "Reference", render: (item) => `<button class="link-btn" data-trace-type="${esc(item.entityType)}" data-trace-id="${esc(item.id)}">${esc(item.reference)}</button>` },
            { label: "Type", render: (item) => esc(item.entityType.replaceAll("_", " ")) },
            { label: "Description", key: "description" },
            { label: "Status", render: (item) => item.status ? statusBadge(item.status) : "-" },
          ], d.items, { emptyText: "No matching traceable records." })}</div>`
        : `<div class="empty-state">No matching traceable records. Try a code such as PO-100 or MB-001.</div>`;

      results.querySelectorAll("[data-trace-id]").forEach((button) => button.addEventListener("click", () => {
        void this.runTrace(button.dataset.traceType, button.dataset.traceId);
      }));
    } catch (err) {
      if (!results || !results.isConnected) return;
      results.innerHTML = `<div class="empty-state"><strong>Search couldn't be completed.</strong><br/>${esc(apiErrorMessage(err))}</div>`;
    }
  },

  async runTrace(type, id) {
    if (!id) return;
    const out = document.getElementById("trace-output");
    const results = document.getElementById("trace-search-results");
    if (out) out.innerHTML = `<div class="empty-state">Loading genealogy and root-cause timeline...</div>`;
    try {
      const d = await Api.get(`/v1/traceability/${type}/${id}`);
      if (!out || !out.isConnected) return;
      if (results) results.innerHTML = "";
      out.innerHTML = `<div class="card">${this.renderTraceNode(d)}</div>`;
    } catch (err) {
      if (!out || !out.isConnected) return;
      out.innerHTML = `<div class="empty-state">${esc(apiErrorMessage(err))}</div>`;
    }
  },

  renderRunNode(run) {
    const op = run.operatorName ? `${esc(run.operatorName)}${run.operatorCode ? ` (${esc(run.operatorCode)})` : ""}` : "Unassigned";
    return `
      <div class="trace-node">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <strong>Run ${esc(run.runCode)}</strong> ${statusBadge(run.status)} on <strong>${esc(run.machineName || "?")}</strong>
            &bull; Operator: <strong>${op}</strong>
          </div>
          ${run.actualStart ? `<span class="muted" style="font-size:0.85em">Started: ${fmtDate(run.actualStart)}</span>` : ""}
        </div>
        ${run.materialBatches && run.materialBatches.length ? `<div style="margin-top:6px"><strong>Materials:</strong> ${run.materialBatches.map((b) => `<span class="badge ${b.status === 'ON_HOLD' ? 'badge-red' : 'badge-blue'}" style="margin-right:4px">${esc(b.lotNumber)} (${esc(b.materialName)}): ${fmtNum(b.quantityReserved)} reserved${b.quantityConsumed !== null ? ", " + fmtNum(b.quantityConsumed) + " consumed" : ""}${b.status && b.status !== 'AVAILABLE' ? ` [${esc(b.status)}]` : ""}</span>`).join("")}</div>` : ""}
        ${run.productBatches && run.productBatches.length ? `<div style="margin-top:4px"><strong>Output:</strong> ${run.productBatches.map((p) => `<span class="badge badge-primary" style="margin-right:4px">${esc(p.code)} (${fmtNum(p.quantityProduced)}) ${statusBadge(p.qualityDisposition)}</span>`).join("")}</div>` : ""}
      </div>`;
  },

  renderTimeline(timeline) {
    if (!timeline || !timeline.length) return "";
    return `
      <div class="section-divider">Event Timeline &amp; Root-Cause Sequence ("At what point did the problem begin?")</div>
      <div class="timeline-container" style="margin-top:14px;border-left:3px solid var(--border, #e2e8f0);padding-left:16px;position:relative">
        ${timeline.map((item) => `
          <div class="timeline-item" style="margin-bottom:14px;position:relative">
            <div style="position:absolute;left:-22px;top:4px;width:10px;height:10px;border-radius:50%;background:${item.severity === 'CRITICAL' ? 'var(--red, #e53e3e)' : item.severity === 'HIGH' ? 'var(--yellow, #dd6b20)' : 'var(--blue, #3182ce)'};box-shadow:0 0 0 2px var(--surface, #ffffff)"></div>
            <div style="font-size:0.8em;color:var(--text-muted, #718096);font-weight:500">${fmtDate(item.timestamp)} &bull; ${timeAgo(item.timestamp)}</div>
            <div style="font-weight:600;margin-top:2px">${esc(item.title)} ${item.severity && item.severity !== 'LOW' ? statusBadge(item.severity) : ''}</div>
            ${item.detail ? `<div style="font-size:0.88em;color:var(--text, #2d3748);margin-top:2px">${esc(item.detail)}</div>` : ''}
          </div>
        `).join("")}
      </div>`;
  },

  renderTraceNode(d) {
    if (d.entityType === "PRODUCTION_ORDER") {
      return `<h3>Order ${esc(d.order.code)} -- ${esc(d.order.productName)}</h3>${statusBadge(d.order.status)}
        <div class="section-divider">Runs</div>${d.runs.map((r) => this.renderRunNode(r)).join("") || "<p class='muted'>No runs.</p>"}
        ${this.renderTimeline(d.timeline)}`;
    }
    if (d.entityType === "PRODUCTION_RUN") {
      return `<h3>Run ${esc(d.run.runCode)}</h3>${this.renderRunNode(d.run)}
        <div class="section-divider">Inspections</div>${dataTable([{ label: "Code", key: "code" }, { label: "Result", render: (i) => statusBadge(i.result) }, { label: "Parameter", key: "parameter" }], d.run.inspections, { emptyText: "None." })}
        ${this.renderTimeline(d.timeline)}`;
    }
    if (d.entityType === "PRODUCT_BATCH") {
      return `<h3>Product Batch ${esc(d.productBatch.code)}</h3>${statusBadge(d.productBatch.qualityDisposition)}
        <p>Produced: ${fmtNum(d.productBatch.quantityProduced)} | Scrapped: ${fmtNum(d.productBatch.scrappedQuantity)}</p>
        ${d.run ? `<div class="section-divider">Genealogy</div>${this.renderRunNode(d.run)}` : ""}
        <div class="section-divider">Defects</div>${dataTable([{ label: "Code", key: "code" }, { label: "Severity", render: (x) => statusBadge(x.severity) }], d.defects, { emptyText: "None." })}
        ${this.renderTimeline(d.timeline)}`;
    }
    if (d.entityType === "MATERIAL_BATCH") {
      const b = d.materialBatch;
      return `<h3>Material Batch ${esc(b.lotNumber)}</h3>${statusBadge(b.status)}
        <p>Total: ${fmtNum(b.totalQuantity)} | Reserved: ${fmtNum(b.reservedQuantity)} | Consumed: ${fmtNum(b.consumedQuantity)} | Available: ${fmtNum(b.availableQuantity)}</p>
        <div class="section-divider">Forward Recall -- affected runs (Acceptance Test AT-4)</div>
        ${d.forwardRecall.affectedRuns.map((r) => this.renderRunNode(r)).join("") || "<p class='muted'>Not yet consumed by any run.</p>"}
        <p class="muted" style="margin-top:8px">Affected orders: ${d.forwardRecall.affectedOrderIds.length}</p>
        ${this.renderTimeline(d.timeline)}`;
    }
    if (d.entityType === "MACHINE") {
      return `<h3>Machine ${esc(d.machine.name)}</h3>${statusBadge(d.machine.status)}
        <div class="section-divider">Runs</div>${d.runs.map((r) => this.renderRunNode(r)).join("") || "<p class='muted'>No runs.</p>"}
        <div class="section-divider">Maintenance History</div>${dataTable([{ label: "Type", key: "type" }, { label: "Status", render: (m) => statusBadge(m.status) }, { label: "Opened", render: (m) => fmtDate(m.openedAt) }], d.maintenanceHistory, { emptyText: "None." })}
        ${this.renderTimeline(d.timeline)}`;
    }
    if (d.entityType === "OPERATOR") {
      return `<h3>Operator: ${esc(d.operator.name || d.operator.employeeCode)}</h3>
        <p class="muted">Code: ${esc(d.operator.employeeCode || "-")} | Shift: ${esc(d.operator.shiftPattern || "-")}</p>
        <div class="section-divider">Runs</div>${d.runs.map((r) => this.renderRunNode(r)).join("") || "<p class='muted'>No runs.</p>"}
        ${this.renderTimeline(d.timeline)}`;
    }
    if (d.entityType === "DEFECT") {
      return `<h3>Defect ${esc(d.defect.code)}</h3>${statusBadge(d.defect.severity)} ${statusBadge(d.defect.status)}<p>${esc(d.defect.description || "")}</p>
        ${d.materialBatch ? `<div class="card" style="margin:8px 0"><strong>Target Material Batch:</strong> ${esc(d.materialBatch.lot_number || d.materialBatch.lotNumber)} ${statusBadge(d.materialBatch.status)}</div>` : ""}
        ${d.run ? `<div class="section-divider">Traced Run</div>${this.renderRunNode(d.run)}` : ""}
        ${this.renderTimeline(d.timeline)}`;
    }
    if (d.entityType === "INCIDENT") {
      const inc = d.incident;
      return `<h3>Incident ${esc(inc.code)}</h3>${statusBadge(inc.severity)} ${statusBadge(inc.status)}<p>${esc(inc.description || "")}</p>
        <div class="grid-2" style="margin:10px 0">
          ${d.machine ? `<div class="card" style="margin-bottom:6px"><strong>Machine:</strong> ${esc(d.machine.name)} (${esc(d.machine.type || '')}) ${statusBadge(d.machine.status)}</div>` : ''}
          ${d.materialBatch ? `<div class="card" style="margin-bottom:6px"><strong>Material Batch:</strong> ${esc(d.materialBatch.lot_number || d.materialBatch.lotNumber)} ${statusBadge(d.materialBatch.status)}</div>` : ''}
          ${d.operator ? `<div class="card" style="margin-bottom:6px"><strong>Operator:</strong> ${esc(d.operator.name || d.operator.employeeCode)}</div>` : ''}
          ${d.order ? `<div class="card" style="margin-bottom:6px"><strong>Order:</strong> ${esc(d.order.code)} ${statusBadge(d.order.status)}</div>` : ''}
        </div>
        ${d.run ? `<div class="section-divider">Traced Run</div>${this.renderRunNode(d.run)}` : ""}
        ${this.renderTimeline(d.timeline)}`;
    }
    return `<pre>${esc(JSON.stringify(d, null, 2))}</pre>`;
  },
};

// Cross-alias for backward compatibility
Views.monitoring = Views.monitoring || {};
Views.monitoring.traceability = () => Views.traceability.traceability();
Views.monitoring.openTraceModal = (type, id) => Views.traceability.openTraceModal(type, id);

window.Views = Views;
