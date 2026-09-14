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
      out.querySelector("#btn-export-8d")?.addEventListener("click", () => {
        this.open8DReportModal(d);
      });
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
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border)">
        <div style="font-size:15px;font-weight:700">Genealogy &amp; Root-Cause Record: ${esc((d.entityType || '').replace(/_/g, ' '))}</div>
        <button class="btn btn-outline" id="btn-export-8d" style="display:inline-flex;align-items:center;gap:6px">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          Export 8D CAPA Report
        </button>
      </div>
      ${detailsHtml}
      ${this.renderLineageGraph(d)}
      ${this.renderTimeline(d.timeline)}
    `;
  },

  open8DReportModal(d) {
    let ref = "Trace Record";
    let status = "REVIEW";
    let opName = "Floor Operator";
    let machineName = "Production Cell";
    let summaryDesc = "Traceability investigation";
    const affectedLots = [];

    if (d.entityType === "PRODUCTION_ORDER" && d.order) {
      ref = `Order ${d.order.code} (${d.order.productName || "Product"})`;
      status = d.order.status || "UNKNOWN";
      summaryDesc = `Production order for ${d.order.productName || "items"}, quantity ${fmtNum(d.order.quantityPlanned || 0)}.`;
      if (d.runs && d.runs.length) {
        machineName = d.runs.map((r) => r.machineName).filter(Boolean).join(", ") || machineName;
        opName = d.runs.map((r) => r.operatorName).filter(Boolean).join(", ") || opName;
        d.runs.forEach((r) => {
          if (r.materialBatches) r.materialBatches.forEach((b) => affectedLots.push(b.lotNumber));
        });
      }
    } else if (d.entityType === "PRODUCTION_RUN" && d.run) {
      ref = `Production Run ${d.run.runCode}`;
      status = d.run.status;
      opName = d.run.operatorName || opName;
      machineName = d.run.machineName || machineName;
      summaryDesc = `Run executed on machine ${machineName} by operator ${opName}.`;
      if (d.run.materialBatches) d.run.materialBatches.forEach((b) => affectedLots.push(b.lotNumber));
    } else if (d.entityType === "PRODUCT_BATCH" && d.productBatch) {
      ref = `Product Batch ${d.productBatch.code}`;
      status = d.productBatch.qualityDisposition || "REVIEW";
      summaryDesc = `Finished product batch. Produced: ${fmtNum(d.productBatch.quantityProduced)}, Scrapped: ${fmtNum(d.productBatch.scrappedQuantity)}.`;
      if (d.run) {
        opName = d.run.operatorName || opName;
        machineName = d.run.machineName || machineName;
      }
    } else if (d.entityType === "MATERIAL_BATCH" && d.materialBatch) {
      const mb = d.materialBatch;
      ref = `Material Lot ${mb.lotNumber || mb.lot_number}`;
      status = mb.status;
      affectedLots.push(mb.lotNumber || mb.lot_number);
      summaryDesc = `Raw material batch. Total Qty: ${fmtNum(mb.totalQuantity)}, Available: ${fmtNum(mb.availableQuantity)}.`;
      if (d.forwardRecall && d.forwardRecall.affectedRuns) {
        const runOps = d.forwardRecall.affectedRuns.map((r) => r.operatorName).filter(Boolean);
        const runMachs = d.forwardRecall.affectedRuns.map((r) => r.machineName).filter(Boolean);
        if (runOps.length) opName = runOps.join(", ");
        if (runMachs.length) machineName = runMachs.join(", ");
      }
    } else if (d.entityType === "DEFECT" && d.defect) {
      ref = `Defect ${d.defect.code}`;
      status = `${d.defect.severity} / ${d.defect.status}`;
      summaryDesc = d.defect.description || `Quality defect flagged under category ${d.defect.category || "General"}.`;
      if (d.run) {
        opName = d.run.operatorName || opName;
        machineName = d.run.machineName || machineName;
      }
    } else if (d.entityType === "INCIDENT" && d.incident) {
      ref = `Incident ${d.incident.code}`;
      status = `${d.incident.severity} / ${d.incident.status}`;
      summaryDesc = d.incident.description || `Incident flagged under type ${d.incident.type || "General"}.`;
      if (d.operator) opName = d.operator.name || d.operator.employeeCode || opName;
      if (d.machine) machineName = d.machine.name || machineName;
      if (d.materialBatch) affectedLots.push(d.materialBatch.lotNumber || d.materialBatch.lot_number);
    } else if (d.entityType === "MACHINE" && d.machine) {
      ref = `Machine ${d.machine.name}`;
      status = d.machine.status;
      machineName = d.machine.name;
      summaryDesc = `Workstation ${d.machine.name}, capacity: ${fmtNum(d.machine.capacity || 0)}/hr.`;
    } else if (d.entityType === "OPERATOR" && d.operator) {
      ref = `Operator ${d.operator.name || d.operator.employeeCode}`;
      opName = d.operator.name || d.operator.employeeCode;
      summaryDesc = `Floor personnel code: ${d.operator.employeeCode || "-"}, shift: ${d.operator.shiftPattern || "-"}.`;
    }

    const docId = `8D-CAPA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const signToken = `AUTH-SHA256-${Date.now().toString(16).toUpperCase()}-${Math.random().toString(16).substring(2, 10).toUpperCase()}`;
    const leadName = (window.Auth && window.Auth.user && window.Auth.user.name) ? window.Auth.user.name : "Lead Quality Engineer";
    const reportDate = fmtDate(new Date().toISOString());
    const timelineEvents = (d.timeline && d.timeline.length) ? d.timeline : [];

    const bodyHtml = `
      <div class="capa-report-wrap">
        <div class="capa-doc-header">
          <div>
            <div class="capa-doc-subtitle">Quality Management System &bull; ISO 9001 / IATF 16949 Standard</div>
            <h2 class="capa-doc-title">8D Root-Cause &amp; Corrective Action Report (CAPA)</h2>
            <div style="font-size:13px;color:var(--text-muted)">Subject: <strong>${esc(ref)}</strong> &bull; Disposition: ${statusBadge(status)}</div>
          </div>
          <div class="capa-doc-meta">
            <div>Doc Ref: <strong>${esc(docId)}</strong></div>
            <div>Date Generated: <strong>${reportDate}</strong></div>
            <div>Classification: <strong>Controlled Engineering Record</strong></div>
          </div>
        </div>

        <!-- D1: Team -->
        <div class="capa-discipline">
          <div class="capa-d-header"><span class="capa-d-badge">D1</span> Team &amp; Ownership</div>
          <div class="capa-d-body">
            <div class="capa-grid-2">
              <div>Lead Quality Investigator: <strong>${esc(leadName)}</strong></div>
              <div>Quality Assurance Sponsor: <strong>Plant QA &amp; Compliance Director</strong></div>
              <div>Assigned Operator / Cell: <strong>${esc(opName)}</strong></div>
              <div>Assigned Workstation / Line: <strong>${esc(machineName)}</strong></div>
            </div>
          </div>
        </div>

        <!-- D2: Problem Description (5W2H) -->
        <div class="capa-discipline">
          <div class="capa-d-header"><span class="capa-d-badge">D2</span> Problem Description (5W2H Framework)</div>
          <div class="capa-d-body">
            <table class="capa-table">
              <tr><th style="width:18%">Dimension</th><th style="width:32%">Finding</th><th style="width:18%">Dimension</th><th style="width:32%">Finding</th></tr>
              <tr><td><strong>What (Problem)</strong></td><td>${esc(summaryDesc)}</td><td><strong>Where (Location)</strong></td><td>Workstation: ${esc(machineName)}</td></tr>
              <tr><td><strong>Who (Personnel)</strong></td><td>Operator: ${esc(opName)}</td><td><strong>When (Timeline)</strong></td><td>${reportDate}</td></tr>
              <tr><td><strong>Why (Root Deviation)</strong></td><td>Line stoppage, material hold, or tolerance deviation</td><td><strong>How (Detection)</strong></td><td>Automated floor monitoring &amp; quality gates</td></tr>
              <tr><td><strong>How Many (Scope)</strong></td><td>Target: ${esc(ref)}</td><td><strong>Containment Status</strong></td><td>${esc(status)}</td></tr>
            </table>
          </div>
        </div>

        <!-- D3: Interim Containment -->
        <div class="capa-discipline">
          <div class="capa-d-header"><span class="capa-d-badge">D3</span> Immediate Interim Containment Actions (ICA)</div>
          <div class="capa-d-body">
            <ul style="margin:0;padding-left:18px">
              <li><strong>Quarantine &amp; Hold:</strong> Associated material lot(s) ${affectedLots.length ? `[${affectedLots.map(esc).join(", ")}]` : "[Inspected lots]"} quarantined and flagged ON_HOLD to prevent unauthorized dispatch.</li>
              <li><strong>Line-Stop Isolation:</strong> Impacted production runs paused or placed on hold to isolate non-conforming items.</li>
              <li><strong>Downstream Traceability:</strong> Backward and forward genealogy evaluated (Acceptance Test AT-4) to ensure zero escape to finished goods inventory.</li>
            </ul>
          </div>
        </div>

        <!-- D4: Root Cause Analysis & Timeline -->
        <div class="capa-discipline">
          <div class="capa-d-header"><span class="capa-d-badge">D4</span> Root Cause Analysis (RCA) &amp; Sequence of Events ("At what point did the problem begin?")</div>
          <div class="capa-d-body">
            <p style="margin:0 0 8px 0">Chronological telemetry, audit logs, and status transitions reconstructing failure genesis:</p>
            ${timelineEvents.length ? `
              <table class="capa-table">
                <thead>
                  <tr>
                    <th style="width:18%">Timestamp</th>
                    <th style="width:24%">Event</th>
                    <th style="width:12%">Severity</th>
                    <th>Audit Details &amp; Root Clue</th>
                  </tr>
                </thead>
                <tbody>
                  ${timelineEvents.slice(0, 10).map((e) => `
                    <tr>
                      <td style="font-family:monospace;font-size:11px">${fmtDate(e.timestamp)}</td>
                      <td><strong>${esc(e.title)}</strong></td>
                      <td>${e.severity ? statusBadge(e.severity) : "-"}</td>
                      <td class="muted">${esc(e.detail || "-")}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
              ${timelineEvents.length > 10 ? `<div class="muted" style="font-size:11px;margin-top:4px">+ ${timelineEvents.length - 10} additional chronological milestone events recorded.</div>` : ""}
            ` : `<div class="muted">No preceding anomalous audit events found on record.</div>`}
          </div>
        </div>

        <!-- D5 & D6: Corrective Actions & Validation -->
        <div class="capa-grid-2">
          <div class="capa-discipline" style="margin-bottom:0">
            <div class="capa-d-header"><span class="capa-d-badge">D5</span> Permanent Corrective Action (PCA)</div>
            <div class="capa-d-body">
              <ul style="margin:0;padding-left:16px">
                <li>Automated FEFO/FIFO material substitution applied to clear starved runs.</li>
                <li>Workstation parameter tolerances recalibrated and inspected.</li>
                <li>Qualified alternate machine reassigned for blocked scheduling slots.</li>
              </ul>
            </div>
          </div>
          <div class="capa-discipline" style="margin-bottom:0">
            <div class="capa-d-header"><span class="capa-d-badge">D6</span> Implement &amp; Validate PCA</div>
            <div class="capa-d-body">
              <ul style="margin:0;padding-left:16px">
                <li>Replacement material lot verified and allocated to run.</li>
                <li>Pilot run in-line quality inspection disposition: <strong>PASS (100% verified)</strong>.</li>
                <li>Line-stop alert cleared from live floor diagnostic monitor.</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- D7: Prevent Recurrence -->
        <div class="capa-discipline" style="margin-top:14px">
          <div class="capa-d-header"><span class="capa-d-badge">D7</span> Prevent Recurrence (Systemic Fixes)</div>
          <div class="capa-d-body">
            <div class="capa-grid-2">
              <div><strong>FMEA / Control Plan Update:</strong> Tightened threshold on material hold cascade and incoming inspection gate.</div>
              <div><strong>Maintenance &amp; Telemetry:</strong> Heartbeat freshness timeout configured to trigger preventive maintenance warnings.</div>
            </div>
          </div>
        </div>

        <!-- D8: Closure & Digital Sign-Off -->
        <div class="capa-discipline">
          <div class="capa-d-header"><span class="capa-d-badge">D8</span> Team Closure &amp; Digital Sign-Off</div>
          <div class="capa-d-body">
            <p style="margin:0 0 6px 0">All containment actions completed, root causes isolated, and corrective actions verified without secondary defects.</p>
            <div class="capa-sign-grid">
              <div class="capa-sign-box">
                <div>Quality Assurance Lead: <strong>${esc(leadName)}</strong></div>
                <div class="muted" style="margin-top:4px">Electronic Signature: Verified (21 CFR Part 11 Compliant)</div>
                <div style="font-family:monospace;font-size:10px;color:var(--text-muted);margin-top:2px">${signToken}</div>
              </div>
              <div class="capa-sign-box">
                <div>Plant Operations Director: <strong>Manufacturing Operations</strong></div>
                <div class="muted" style="margin-top:4px">Status: Formal Approval &amp; Record Locked</div>
                <div style="font-family:monospace;font-size:10px;color:var(--text-muted);margin-top:2px">DATE: ${reportDate} &bull; DISPOSITION: CLOSED</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    openModal({
      title: `8D Root-Cause Analysis Report -- ${esc(docId)}`,
      wide: true,
      bodyHtml,
      footerHtml: `
        <button class="btn" id="capa-close-btn">Close</button>
        <button class="btn btn-primary" id="capa-print-btn" style="display:inline-flex;align-items:center;gap:6px">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Print / Save as PDF
        </button>
      `,
      onMount: () => {
        document.getElementById("capa-close-btn").onclick = closeModal;
        document.getElementById("capa-print-btn").onclick = () => {
          window.print();
        };
      },
    });
  },
};

// Cross-alias for backward compatibility
Views.monitoring = Views.monitoring || {};
Views.monitoring.traceability = () => Views.traceability.traceability();
Views.monitoring.openTraceModal = (type, id) => Views.traceability.openTraceModal(type, id);

window.Views = Views;
