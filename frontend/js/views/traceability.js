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
      out.querySelectorAll("[data-trace-jump-type]").forEach((node) => {
        node.addEventListener("click", () => {
          const t = node.dataset.traceJumpType;
          const targetId = node.dataset.traceJumpId;
          if (targetId) void this.runTrace(t, targetId);
        });
      });
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
      <div class="timeline-container">
        ${timeline.map((item) => `
          <div class="timeline-item">
            <div class="timeline-dot ${item.severity ? item.severity.toLowerCase() : 'info'}"></div>
            <div class="timeline-meta">${fmtDate(item.timestamp)} &bull; ${timeAgo(item.timestamp)}</div>
            <div class="timeline-title">${esc(item.title)} ${item.severity && item.severity !== 'LOW' ? statusBadge(item.severity) : ''}</div>
            ${item.detail ? `<div class="timeline-detail">${esc(item.detail)}</div>` : ''}
          </div>
        `).join("")}
      </div>`;
  },

  renderLineageGraph(d) {
    const materials = [];
    const resources = [];
    const runs = [];
    const outputs = [];
    const orders = [];

    const seenMat = new Set();
    const seenRes = new Set();
    const seenRun = new Set();
    const seenOut = new Set();
    const seenOrd = new Set();

    const addMat = (id, title, sub, status) => {
      if (!id || seenMat.has(id)) return;
      seenMat.add(id);
      materials.push({ type: "MATERIAL_BATCH", id, title, sub, status });
    };

    const addRes = (type, id, title, sub, status) => {
      const key = `${type}-${id}`;
      if (!id || seenRes.has(key)) return;
      seenRes.add(key);
      resources.push({ type, id, title, sub, status });
    };

    const addRun = (id, title, sub, status) => {
      if (!id || seenRun.has(id)) return;
      seenRun.add(id);
      runs.push({ type: "PRODUCTION_RUN", id, title, sub, status });
    };

    const addOut = (id, title, sub, status) => {
      if (!id || seenOut.has(id)) return;
      seenOut.add(id);
      outputs.push({ type: "PRODUCT_BATCH", id, title, sub, status });
    };

    const addOrd = (id, title, sub, status) => {
      if (!id || seenOrd.has(id)) return;
      seenOrd.add(id);
      orders.push({ type: "PRODUCTION_ORDER", id, title, sub, status });
    };

    const harvestRun = (r) => {
      if (!r) return;
      addRun(r.runId || r.id, `Run ${r.runCode || r.code}`, r.machineName ? `On ${r.machineName}` : "Production Run", r.status);
      if (r.machineId) addRes("MACHINE", r.machineId, r.machineName || "Machine", "Workstation", null);
      if (r.operatorId) addRes("OPERATOR", r.operatorId, r.operatorName || r.operatorCode || "Operator", `Code: ${r.operatorCode || "-"}`, null);
      if (r.orderId) addOrd(r.orderId, `Order ${r.orderCode || r.orderId.substring(0, 8)}`, "Parent Order", null);
      if (r.materialBatches) {
        r.materialBatches.forEach((b) => {
          addMat(b.batchId, b.lotNumber || "Lot", b.materialName || "Material", b.status);
        });
      }
      if (r.productBatches) {
        r.productBatches.forEach((pb) => {
          addOut(pb.productBatchId || pb.id, pb.code || "Batch", `Qty: ${pb.quantityProduced}`, pb.qualityDisposition);
        });
      }
    };

    if (d.order) {
      addOrd(d.order.id, `Order ${d.order.code}`, d.order.product_name || d.order.productName || "Finished Good", d.order.status);
    }
    if (d.runs) {
      d.runs.forEach((r) => harvestRun(r));
    }
    if (d.run) {
      harvestRun(d.run);
    }
    if (d.forwardRecall && d.forwardRecall.affectedRuns) {
      d.forwardRecall.affectedRuns.forEach((r) => harvestRun(r));
    }
    if (d.materialBatch) {
      const mb = d.materialBatch;
      addMat(mb.id, mb.lot_number || mb.lotNumber || "Lot", mb.material_name || mb.materialName || "Material Batch", mb.status);
    }
    if (d.productBatch) {
      const pb = d.productBatch;
      addOut(pb.id, pb.code || "Batch", `Qty: ${pb.quantity_produced || pb.quantityProduced || 0}`, pb.quality_disposition || pb.qualityDisposition);
    }
    if (d.machine) {
      addRes("MACHINE", d.machine.id, d.machine.name, d.machine.type || "Machine", d.machine.status);
    }
    if (d.operator) {
      addRes("OPERATOR", d.operator.id, d.operator.name || d.operator.employee_code || "Operator", `Code: ${d.operator.employee_code || d.operator.employeeCode || "-"}`, null);
    }

    const renderNodeBox = (item) => {
      let nodeClass = "";
      const st = (item.status || "").toUpperCase();
      if (["ON_HOLD", "FAULTED", "REJECTED", "CRITICAL", "SCRAPPED"].includes(st)) {
        nodeClass = "node-danger";
      } else if (["WARNING", "MAINTENANCE_REQUIRED", "PENDING", "HOLD"].includes(st)) {
        nodeClass = "node-warning";
      } else if (["COMPLETED", "AVAILABLE", "RELEASED", "PASS"].includes(st)) {
        nodeClass = "node-success";
      } else if (["IN_PROGRESS", "RUNNING", "ACTIVE"].includes(st)) {
        nodeClass = "node-primary";
      }
      return `
        <div class="lineage-node ${nodeClass}" data-trace-jump-type="${esc(item.type)}" data-trace-jump-id="${esc(item.id)}" title="Click to inspect ${esc(item.title)}">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(item.title)}</div>
          <div class="muted" style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(item.sub || "")}</div>
          <div style="margin-top:4px">${item.status ? statusBadge(item.status) : `<span class="badge badge-gray" style="font-size:10px">${esc(item.type.replace('_', ' '))}</span>`}</div>
        </div>
      `;
    };

    const renderStage = (title, items) => `
      <div class="lineage-stage">
        <div class="lineage-stage-title">${title} (${items.length})</div>
        ${items.length ? items.map(renderNodeBox).join("") : `<div class="muted" style="font-size:11px;padding:8px;border:1px dashed var(--border);border-radius:var(--radius-sm);text-align:center">N/A</div>`}
      </div>
    `;

    return `
      <div class="section-divider">Visual Unit Lineage &amp; Supply Chain Pipeline (Click any node to focus)</div>
      <div class="lineage-graph-container">
        <div class="lineage-pipeline">
          ${renderStage("1. Raw Materials", materials)}
          <div class="lineage-connector">&rarr;</div>
          ${renderStage("2. Workstation &amp; Operator", resources)}
          <div class="lineage-connector">&rarr;</div>
          ${renderStage("3. Production Run", runs)}
          <div class="lineage-connector">&rarr;</div>
          ${renderStage("4. Output Lots", outputs)}
          <div class="lineage-connector">&rarr;</div>
          ${renderStage("5. Production Order", orders)}
        </div>
      </div>
    `;
  },

  renderTraceNode(d) {
    let detailsHtml = "";
    if (d.entityType === "PRODUCTION_ORDER") {
      detailsHtml = `<h3>Order ${esc(d.order.code)} -- ${esc(d.order.productName)}</h3>${statusBadge(d.order.status)}
        <div class="section-divider">Runs</div>${d.runs.map((r) => this.renderRunNode(r)).join("") || "<p class='muted'>No runs.</p>"}`;
    } else if (d.entityType === "PRODUCTION_RUN") {
      detailsHtml = `<h3>Run ${esc(d.run.runCode)}</h3>${this.renderRunNode(d.run)}
        <div class="section-divider">Inspections</div>${dataTable([{ label: "Code", key: "code" }, { label: "Result", render: (i) => statusBadge(i.result) }, { label: "Parameter", key: "parameter" }], d.run.inspections, { emptyText: "None." })}`;
    } else if (d.entityType === "PRODUCT_BATCH") {
      detailsHtml = `<h3>Product Batch ${esc(d.productBatch.code)}</h3>${statusBadge(d.productBatch.qualityDisposition)}
        <p>Produced: ${fmtNum(d.productBatch.quantityProduced)} | Scrapped: ${fmtNum(d.productBatch.scrappedQuantity)}</p>
        ${d.run ? `<div class="section-divider">Genealogy</div>${this.renderRunNode(d.run)}` : ""}
        <div class="section-divider">Defects</div>${dataTable([{ label: "Code", key: "code" }, { label: "Severity", render: (x) => statusBadge(x.severity) }], d.defects, { emptyText: "None." })}`;
    } else if (d.entityType === "MATERIAL_BATCH") {
      const b = d.materialBatch;
      detailsHtml = `<h3>Material Batch ${esc(b.lotNumber)}</h3>${statusBadge(b.status)}
        <p>Total: ${fmtNum(b.totalQuantity)} | Reserved: ${fmtNum(b.reservedQuantity)} | Consumed: ${fmtNum(b.consumedQuantity)} | Available: ${fmtNum(b.availableQuantity)}</p>
        <div class="section-divider">Forward Recall -- affected runs (Acceptance Test AT-4)</div>
        ${d.forwardRecall.affectedRuns.map((r) => this.renderRunNode(r)).join("") || "<p class='muted'>Not yet consumed by any run.</p>"}
        <p class="muted" style="margin-top:8px">Affected orders: ${d.forwardRecall.affectedOrderIds.length}</p>`;
    } else if (d.entityType === "MACHINE") {
      detailsHtml = `<h3>Machine ${esc(d.machine.name)}</h3>${statusBadge(d.machine.status)}
        <div class="section-divider">Runs</div>${d.runs.map((r) => this.renderRunNode(r)).join("") || "<p class='muted'>No runs.</p>"}
        <div class="section-divider">Maintenance History</div>${dataTable([{ label: "Type", key: "type" }, { label: "Status", render: (m) => statusBadge(m.status) }, { label: "Opened", render: (m) => fmtDate(m.openedAt) }], d.maintenanceHistory, { emptyText: "None." })}`;
    } else if (d.entityType === "OPERATOR") {
      detailsHtml = `<h3>Operator: ${esc(d.operator.name || d.operator.employeeCode)}</h3>
        <p class="muted">Code: ${esc(d.operator.employeeCode || "-")} | Shift: ${esc(d.operator.shiftPattern || "-")}</p>
        <div class="section-divider">Runs</div>${d.runs.map((r) => this.renderRunNode(r)).join("") || "<p class='muted'>No runs.</p>"}`;
    } else if (d.entityType === "DEFECT") {
      detailsHtml = `<h3>Defect ${esc(d.defect.code)}</h3>${statusBadge(d.defect.severity)} ${statusBadge(d.defect.status)}<p>${esc(d.defect.description || "")}</p>
        ${d.materialBatch ? `<div class="card" style="margin:8px 0"><strong>Target Material Batch:</strong> ${esc(d.materialBatch.lot_number || d.materialBatch.lotNumber)} ${statusBadge(d.materialBatch.status)}</div>` : ""}
        ${d.run ? `<div class="section-divider">Traced Run</div>${this.renderRunNode(d.run)}` : ""}`;
    } else if (d.entityType === "INCIDENT") {
      const inc = d.incident;
      detailsHtml = `<h3>Incident ${esc(inc.code)}</h3>${statusBadge(inc.severity)} ${statusBadge(inc.status)}<p>${esc(inc.description || "")}</p>
        <div class="grid-2" style="margin:10px 0">
          ${d.machine ? `<div class="card" style="margin-bottom:6px"><strong>Machine:</strong> ${esc(d.machine.name)} (${esc(d.machine.type || '')}) ${statusBadge(d.machine.status)}</div>` : ''}
          ${d.materialBatch ? `<div class="card" style="margin-bottom:6px"><strong>Material Batch:</strong> ${esc(d.materialBatch.lot_number || d.materialBatch.lotNumber)} ${statusBadge(d.materialBatch.status)}</div>` : ''}
          ${d.operator ? `<div class="card" style="margin-bottom:6px"><strong>Operator:</strong> ${esc(d.operator.name || d.operator.employeeCode)}</div>` : ''}
          ${d.order ? `<div class="card" style="margin-bottom:6px"><strong>Order:</strong> ${esc(d.order.code)} ${statusBadge(d.order.status)}</div>` : ''}
        </div>
        ${d.run ? `<div class="section-divider">Traced Run</div>${this.renderRunNode(d.run)}` : ""}`;
    } else {
      detailsHtml = `<pre>${esc(JSON.stringify(d, null, 2))}</pre>`;
    }

    return `
      ${detailsHtml}
      ${this.renderLineageGraph(d)}
      ${this.renderTimeline(d.timeline)}
    `;
  },
};

// Cross-alias for backward compatibility
Views.monitoring = Views.monitoring || {};
Views.monitoring.traceability = () => Views.traceability.traceability();
Views.monitoring.openTraceModal = (type, id) => Views.traceability.openTraceModal(type, id);

window.Views = Views;
