/* Sections 10-11 (Users/Roles), 38 (Audit Log), 41 (Reports), System
   Configuration. */
var Views = window.Views || {};
Views.admin = {

  async users() {
    const [usersResp, rolesResp, depsResp] = await Promise.all([Api.get("/v1/users"), Api.get("/v1/roles"), Api.get("/v1/departments")]);
    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="page-header"><h2>Users</h2><div class="page-actions"><button class="btn btn-primary" id="new-user-btn">+ New User</button></div></div>
      <div class="card">${dataTable([
        { label: "Name", key: "name" }, { label: "Username", key: "username" }, { label: "Email", key: "email" },
        { label: "Department", key: "department" }, { label: "Roles", render: (u) => u.roles.map((r) => `<span class="badge badge-primary" style="margin-right:3px">${esc(r)}</span>`).join("") },
        { label: "Status", render: (u) => statusBadge(u.status) },
        { label: "", render: (u) => `<button class="btn btn-sm" data-edit="${u.id}">Edit</button>` },
      ], usersResp.items, { emptyText: "No users." })}</div>
    `;
    document.getElementById("new-user-btn").addEventListener("click", () => this.userModal(null, rolesResp.items, depsResp.items));
    content.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => this.userModal(usersResp.items.find((u) => u.id === b.dataset.edit), rolesResp.items, depsResp.items)));
  },

  userModal(user, roles, departments) {
    const isEdit = !!user;
    openModal({
      title: isEdit ? `Edit ${user.username}` : "New User",
      bodyHtml: `<form id="user-form"><div class="form-grid">
        <div class="field"><label>Name</label><input name="name" value="${esc(user?.name || "")}" ${isEdit ? "" : "required"} /></div>
        <div class="field"><label>Username</label><input name="username" value="${esc(user?.username || "")}" ${isEdit ? "disabled" : "required"} /></div>
        <div class="field"><label>Email</label><input name="email" type="email" value="${esc(user?.email || "")}" ${isEdit ? "" : "required"} /></div>
        <div class="field"><label>Phone</label><input name="phone" value="${esc(user?.phone || "")}" /></div>
        <div class="field"><label>Department</label><select name="departmentId"><option value="">--</option>${optionList(departments, "id", (d) => d.name)}</select></div>
        <div class="field"><label>Status</label><select name="status"><option ${user?.status === "ACTIVE" ? "selected" : ""}>ACTIVE</option><option ${user?.status === "INACTIVE" ? "selected" : ""}>INACTIVE</option><option ${user?.status === "LOCKED" ? "selected" : ""}>LOCKED</option><option ${user?.status === "SUSPENDED" ? "selected" : ""}>SUSPENDED</option></select></div>
        <div class="field span-2"><label>Roles</label>
          <select name="roleIds" multiple size="6">${roles.map((r) => `<option value="${r.id}" ${user?.roles?.includes(r.name) ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select>
        </div>
        <div class="field span-2"><label>${isEdit ? "New Password (leave blank to keep current)" : "Password"}</label><input name="password" type="password" ${isEdit ? "" : "required"} /></div>
      </div>
      <div id="user-form-error" class="form-error" hidden style="margin-top:10px"></div>
      </form>`,
      footerHtml: `<button class="btn" id="cancel-btn">Cancel</button><button class="btn btn-primary" id="save-btn">${isEdit ? "Save" : "Create"}</button>`,
      onMount: () => {
        document.getElementById("cancel-btn").onclick = closeModal;
        document.getElementById("save-btn").onclick = async () => {
          const form = document.getElementById("user-form");
          const data = formToObject(form);
          data.roleIds = Array.from(form.roleIds.selectedOptions).map((o) => o.value);
          if (!data.password) delete data.password;
          if (!data.departmentId) delete data.departmentId;
          try {
            if (isEdit) await Api.patch(`/v1/users/${user.id}`, data);
            else await Api.post("/v1/users", data);
            closeModal(); toast(isEdit ? "User updated." : "User created.", "success"); App.route();
          } catch (err) {
            const el = document.getElementById("user-form-error"); el.textContent = apiErrorMessage(err); el.hidden = false;
          }
        };
      },
    });
  },

  async roles() {
    const [rolesResp, permsResp] = await Promise.all([Api.get("/v1/roles"), Api.get("/v1/permissions")]);
    const content = document.getElementById("content");

    const CATEGORIES = [
      {
        id: "users",
        name: "Users & Governance",
        icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
        codes: ["MANAGE_USERS", "MANAGE_ROLES", "MANAGE_SYSTEM_SETTINGS", "ADMIN_SEARCH"]
      },
      {
        id: "production",
        name: "Production & Planning",
        icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon><line x1="19" y1="12" x2="5" y2="12"></line></svg>`,
        codes: ["CREATE_ORDERS", "APPROVE_ORDERS", "VIEW_ORDERS", "ALLOCATE_RESOURCES", "EXECUTE_PRODUCTION", "VIEW_PRODUCTION", "MANAGE_PROCESSES", "VIEW_PROCESSES"]
      },
      {
        id: "resources",
        name: "Resources & Equipment",
        icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`,
        codes: ["MANAGE_MACHINES", "VIEW_MACHINES", "MANAGE_MATERIALS", "VIEW_MATERIALS", "MANAGE_SUPPLIERS", "MANAGE_MAINTENANCE", "VIEW_MAINTENANCE", "REPORT_MAINTENANCE"]
      },
      {
        id: "quality",
        name: "Quality & Compliance",
        icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
        codes: ["INSPECT_BATCH", "VIEW_QUALITY", "CREATE_DEFECT", "REPORT_QUALITY_DEFECT", "CREATE_HOLD", "REQUEST_HOLD", "RELEASE_HOLD", "CREATE_NCR"]
      },
      {
        id: "monitoring",
        name: "Monitoring & Operations",
        icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`,
        codes: ["MANAGE_INCIDENTS", "REPORT_INCIDENTS", "MANAGE_ALERTS", "VIEW_RISK", "CREATE_OVERRIDE", "APPROVE_OVERRIDE"]
      },
      {
        id: "traceability",
        name: "Traceability & Genealogy",
        icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`,
        codes: ["VIEW_TRACEABILITY_ALL", "VIEW_TRACEABILITY_LIMITED"]
      },
      {
        id: "audit",
        name: "Audit & Reporting",
        icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
        codes: ["VIEW_AUDIT_LOG_ALL", "VIEW_AUDIT_LOG_LIMITED", "VIEW_AUDIT_LOG_OWN", "VIEW_REPORTS"]
      }
    ];

    const permMap = new Map();
    permsResp.items.forEach((p) => permMap.set(p.code, p));

    // Handle any extra/unmapped permissions
    const mappedCodes = new Set(CATEGORIES.flatMap((c) => c.codes));
    const extraPerms = permsResp.items.filter((p) => !mappedCodes.has(p.code));
    if (extraPerms.length > 0) {
      CATEGORIES.push({
        id: "other",
        name: "Other Permissions",
        icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line></svg>`,
        codes: extraPerms.map((p) => p.code)
      });
    }

    const totalPermsCount = permsResp.items.length;
    const activeRoleId = (this._activeRoleId && rolesResp.items.some((r) => r.id === this._activeRoleId))
      ? this._activeRoleId
      : (rolesResp.items[0] ? rolesResp.items[0].id : "");

    content.innerHTML = `
      <div class="roles-view-container">
        <div class="page-header">
          <div>
            <h2>Roles &amp; Permissions</h2>
            <p class="muted" style="margin: 4px 0 0 0; font-size: 13px;">Configure role-based access control (RBAC) and functional authority for each system role.</p>
          </div>
        </div>

        <!-- Role Selector Tabs -->
        <div class="role-tabs-bar" role="tablist">
          ${rolesResp.items.map((r) => {
            const assignedCount = (r.permissions || []).length;
            const isActive = r.id === activeRoleId;
            return `
              <button type="button" class="role-tab-btn ${isActive ? "active" : ""}" data-role-tab="${r.id}" role="tab" aria-selected="${isActive}">
                <span>${esc(r.name)}</span>
                <span class="role-tab-badge" id="tab-badge-${r.id}">${assignedCount}/${totalPermsCount}</span>
              </button>`;
          }).join("")}
        </div>

        <!-- Role Permission Panels -->
        ${rolesResp.items.map((r) => {
          const isActive = r.id === activeRoleId;
          const assignedCount = (r.permissions || []).length;

          return `
            <div class="role-panel ${isActive ? "active" : ""}" id="role-panel-${r.id}" data-panel-role="${r.id}">
              <div class="role-overview-card">
                <div class="role-meta-row">
                  <div class="role-title-group">
                    <div class="role-title-line">
                      <h3>${esc(r.name)}</h3>
                      <span class="badge badge-primary" id="role-summary-badge-${r.id}">${assignedCount} of ${totalPermsCount} granted</span>
                    </div>
                    <p class="role-description">${esc(r.description || "System functional role.")}</p>
                  </div>
                  <div class="role-actions-group">
                    <button class="btn btn-sm" data-select-all-role="${r.id}">Select All</button>
                    <button class="btn btn-sm" data-clear-all-role="${r.id}">Deselect All</button>
                    <button class="btn btn-sm btn-primary" data-save-role="${r.id}">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                      Save Permissions
                    </button>
                  </div>
                </div>

                <div class="role-toolbar">
                  <div class="role-filter-box">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input type="text" class="role-perm-filter" data-filter-role="${r.id}" placeholder="Filter permissions in this role..." autocomplete="off" />
                  </div>
                  <span class="muted" style="font-size: 12px;">Changes take effect immediately upon saving.</span>
                </div>
              </div>

              <!-- Categorized Grid of Permissions -->
              <div class="perm-categories-grid" id="categories-grid-${r.id}">
                ${CATEGORIES.map((cat) => {
                  const catPerms = cat.codes.map((c) => permMap.get(c)).filter(Boolean);
                  if (!catPerms.length) return "";
                  const catChecked = catPerms.filter((p) => r.permissions.includes(p.code)).length;

                  return `
                    <div class="perm-category-card" data-cat-id="${cat.id}">
                      <div class="perm-category-header">
                        <div class="perm-category-title">
                          ${cat.icon}
                          <span>${esc(cat.name)}</span>
                        </div>
                        <div class="perm-category-controls">
                          <span class="cat-count-badge" id="cat-badge-${r.id}-${cat.id}">${catChecked}/${catPerms.length}</span>
                          <button type="button" class="cat-toggle-link" data-cat-toggle="${cat.id}" data-role-id="${r.id}" title="Toggle all in ${esc(cat.name)}">
                            Toggle
                          </button>
                        </div>
                      </div>

                      <div class="perm-items-list">
                        ${catPerms.map((p) => {
                          const isChecked = r.permissions.includes(p.code);
                          return `
                            <label class="perm-item-row ${isChecked ? "is-checked" : ""}" data-perm-code="${esc(p.code)}" data-perm-desc="${esc((p.description || '').toLowerCase())}">
                              <div class="perm-checkbox-wrap">
                                <input type="checkbox" data-role="${r.id}" data-cat="${cat.id}" value="${p.code}" ${isChecked ? "checked" : ""} />
                              </div>
                              <div class="perm-info">
                                <div class="perm-code-line">
                                  <span class="perm-code">${esc(p.code)}</span>
                                </div>
                                <span class="perm-desc">${esc(p.description || "")}</span>
                              </div>
                            </label>`;
                        }).join("")}
                      </div>
                    </div>`;
                }).join("")}
              </div>
            </div>`;
        }).join("")}
      </div>
    `;

    // Helper: update role and category counters
    const updateCounters = (roleId) => {
      const panel = document.getElementById(`role-panel-${roleId}`);
      if (!panel) return;
      const allCheckboxes = panel.querySelectorAll(`input[data-role="${roleId}"]`);
      const checkedBoxes = panel.querySelectorAll(`input[data-role="${roleId}"]:checked`);
      const assignedCount = checkedBoxes.length;

      // Update role badges
      const tabBadge = document.getElementById(`tab-badge-${roleId}`);
      if (tabBadge) tabBadge.textContent = `${assignedCount}/${totalPermsCount}`;
      const sumBadge = document.getElementById(`role-summary-badge-${roleId}`);
      if (sumBadge) sumBadge.textContent = `${assignedCount} of ${totalPermsCount} granted`;

      // Update category badges
      CATEGORIES.forEach((cat) => {
        const catInputs = panel.querySelectorAll(`input[data-role="${roleId}"][data-cat="${cat.id}"]`);
        const catChecked = panel.querySelectorAll(`input[data-role="${roleId}"][data-cat="${cat.id}"]:checked`);
        const catBadge = document.getElementById(`cat-badge-${roleId}-${cat.id}`);
        if (catBadge) catBadge.textContent = `${catChecked.length}/${catInputs.length}`;
      });
    };

    // Tab switching
    content.querySelectorAll(".role-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const roleId = btn.dataset.roleTab;
        this._activeRoleId = roleId;
        content.querySelectorAll(".role-tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.roleTab === roleId));
        content.querySelectorAll(".role-panel").forEach((p) => p.classList.toggle("active", p.dataset.panelRole === roleId));
      });
    });

    // Row click & checkbox change handler
    content.querySelectorAll(".perm-item-row input[type='checkbox']").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const row = cb.closest(".perm-item-row");
        if (row) row.classList.toggle("is-checked", cb.checked);
        updateCounters(cb.dataset.role);
      });
    });

    // Category toggle link (select/deselect all in category)
    content.querySelectorAll("[data-cat-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const catId = btn.dataset.catToggle;
        const roleId = btn.dataset.roleId;
        const panel = document.getElementById(`role-panel-${roleId}`);
        if (!panel) return;
        const catInputs = Array.from(panel.querySelectorAll(`input[data-role="${roleId}"][data-cat="${catId}"]`));
        const allChecked = catInputs.every((cb) => cb.checked);
        catInputs.forEach((cb) => {
          cb.checked = !allChecked;
          const row = cb.closest(".perm-item-row");
          if (row) row.classList.toggle("is-checked", cb.checked);
        });
        updateCounters(roleId);
      });
    });

    // Role-level Select All
    content.querySelectorAll("[data-select-all-role]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const roleId = btn.dataset.selectAllRole;
        const panel = document.getElementById(`role-panel-${roleId}`);
        if (!panel) return;
        panel.querySelectorAll(`input[data-role="${roleId}"]`).forEach((cb) => {
          cb.checked = true;
          const row = cb.closest(".perm-item-row");
          if (row) row.classList.add("is-checked");
        });
        updateCounters(roleId);
      });
    });

    // Role-level Deselect All
    content.querySelectorAll("[data-clear-all-role]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const roleId = btn.dataset.clearAllRole;
        const panel = document.getElementById(`role-panel-${roleId}`);
        if (!panel) return;
        panel.querySelectorAll(`input[data-role="${roleId}"]`).forEach((cb) => {
          cb.checked = false;
          const row = cb.closest(".perm-item-row");
          if (row) row.classList.remove("is-checked");
        });
        updateCounters(roleId);
      });
    });

    // Live search filter inside active role
    content.querySelectorAll(".role-perm-filter").forEach((input) => {
      input.addEventListener("input", (e) => {
        const q = e.target.value.trim().toLowerCase();
        const roleId = input.dataset.filterRole;
        const panel = document.getElementById(`role-panel-${roleId}`);
        if (!panel) return;

        panel.querySelectorAll(".perm-category-card").forEach((card) => {
          let hasMatch = false;
          card.querySelectorAll(".perm-item-row").forEach((row) => {
            const code = row.dataset.permCode.toLowerCase();
            const desc = row.dataset.permDesc;
            const matches = !q || code.includes(q) || desc.includes(q);
            row.style.display = matches ? "flex" : "none";
            if (matches) hasMatch = true;
          });
          card.style.display = hasMatch ? "flex" : "none";
        });
      });
    });

    // Save button handler
    content.querySelectorAll("[data-save-role]").forEach((b) => b.addEventListener("click", async () => {
      const roleId = b.dataset.saveRole;
      const roleObj = rolesResp.items.find((r) => r.id === roleId);
      const roleName = roleObj ? roleObj.name : "Role";
      const codes = Array.from(content.querySelectorAll(`input[data-role="${roleId}"]:checked`)).map((c) => c.value);
      try {
        b.disabled = true;
        b.textContent = "Saving...";
        await Api.patch(`/v1/roles/${roleId}/permissions`, { permissionCodes: codes });
        toast(`Permissions updated for ${roleName}.`, "success");
        // Update local object so counts stay synced
        if (roleObj) roleObj.permissions = codes;
        updateCounters(roleId);
      } catch (err) {
        notifyError(err);
      } finally {
        b.disabled = false;
        b.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save Permissions`;
      }
    }));
  },

  // ---------------- Audit Logs (Section 38) ----------------

  async auditLogs() {
    const d = await Api.get("/v1/audit-logs?limit=300");
    const chain = await Api.get("/v1/audit-logs/verify-chain").catch(() => null);
    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="page-header"><h2>Audit Logs</h2>
        <div class="page-actions">${chain ? `<span class="badge ${chain.ok ? "badge-green" : "badge-red"}">Hash chain: ${chain.ok ? "VERIFIED (" + chain.checked + " entries)" : "BROKEN at seq " + chain.brokenAtSeq}</span>` : ""}</div>
      </div>
      <p class="flow-note">Append-only, hash-chained (Section 38). Scope follows your permission: full / limited-to-shop-floor-entities / own actions only (Section 7).</p>
      <div class="card">${dataTable([
        { label: "Seq", key: "seq" }, { label: "When", render: (a) => fmtDate(a.timestamp) }, { label: "User", key: "username" },
        { label: "Action", key: "action" }, { label: "Entity", render: (a) => a.entityType ? `${a.entityType} / ${(a.entityId || "").slice(0, 8)}` : "-" },
        { label: "Reason", key: "reason" },
      ], d.items, { emptyText: "No audit entries visible to your role." })}</div>
    `;
  },

  // ---------------- Reports (Section 41) ----------------

  async reports() {
    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="page-header"><h2>Reports</h2><div class="page-actions"><button class="btn" id="refresh-report-btn">Refresh</button></div></div>
      <div class="tabs">
        <button class="tab-btn active" data-tab="production">Production</button>
        <button class="tab-btn" data-tab="resources">Resources</button>
        <button class="tab-btn" data-tab="quality">Quality</button>
        <button class="tab-btn" data-tab="traceability">Traceability</button>
      </div>
      <div id="report-body"><div class="empty-state">Loading...</div></div>
    `;
    const reportBody = content.querySelector("#report-body");
    let requestVersion = 0;
    const loadTab = async (tab) => {
      const version = ++requestVersion;
      content.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
      reportBody.innerHTML = `<div class="empty-state">Loading report...</div>`;
      try {
        const d = await Api.get(`/v1/reports/${tab}`);
        if (version !== requestVersion || !reportBody.isConnected) return;
        reportBody.innerHTML = this.renderReport(tab, d);
      } catch (err) {
        if (version !== requestVersion || !reportBody.isConnected) return;
        reportBody.innerHTML = `<div class="empty-state"><strong>Couldn’t load this report.</strong><br/>${esc(apiErrorMessage(err))}<br/><button class="btn" id="retry-report-btn" style="margin-top:12px">Try again</button></div>`;
        reportBody.querySelector("#retry-report-btn").addEventListener("click", () => loadTab(tab));
      }
    };
    content.querySelectorAll(".tab-btn").forEach((b) => b.addEventListener("click", () => void loadTab(b.dataset.tab)));
    content.querySelector("#refresh-report-btn").addEventListener("click", () => {
      const active = content.querySelector(".tab-btn.active");
      void loadTab(active ? active.dataset.tab : "production");
    });
    void loadTab("production");
  },

  renderReport(tab, d) {
    const countTable = (counts, emptyText) => dataTable([
      { label: "Status", render: ([status]) => statusBadge(status) },
      { label: "Count", render: ([, count]) => fmtNum(count, 0) },
    ], Object.entries(counts || {}), { emptyText });
    const rate = (value) => `${fmtNum((Number(value) || 0) * 100)}%`;

    if (tab === "production") {
      return `
        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-value">${fmtNum(d.totalOrders, 0)}</div><div class="kpi-label">Total orders</div></div>
          <div class="kpi-card accent-info"><div class="kpi-value">${fmtNum(d.totalRuns, 0)}</div><div class="kpi-label">Total production runs</div></div>
          <div class="kpi-card ${d.delayedOrders.length ? "accent-warning" : "accent-success"}"><div class="kpi-value">${fmtNum(d.delayedOrders.length, 0)}</div><div class="kpi-label">Delayed orders</div></div>
        </div>
        <div class="grid-2">
          <div class="card"><h3>Orders by status</h3>${countTable(d.ordersByStatus, "No orders to report.")}</div>
          <div class="card"><h3>Delayed orders</h3>${dataTable([
            { label: "Order", key: "orderCode" }, { label: "Due", render: (o) => fmtDate(o.dueDate) },
          ], d.delayedOrders, { emptyText: "No delayed orders." })}</div>
        </div>
        <div class="card"><h3>Completed production runs</h3>${dataTable([
          { label: "Run", key: "runCode" }, { label: "Order", key: "orderCode" },
          { label: "Planned", render: (r) => fmtNum(r.planned) }, { label: "Actual", render: (r) => fmtNum(r.actual) },
          { label: "Status", render: (r) => statusBadge(r.status) },
        ], d.plannedVsActual, { emptyText: "No completed runs yet." })}</div>`;
    }

    if (tab === "resources") {
      return `
        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-value">${fmtNum(d.operatorCount, 0)}</div><div class="kpi-label">Operators</div></div>
          <div class="kpi-card ${d.materialShortages.length ? "accent-warning" : "accent-success"}"><div class="kpi-value">${fmtNum(d.materialShortages.length, 0)}</div><div class="kpi-label">Materials without available stock</div></div>
        </div>
        <div class="grid-2">
          <div class="card"><h3>Machines by status</h3>${countTable(d.machinesByStatus, "No machines to report.")}</div>
          <div class="card"><h3>Material shortages</h3>${dataTable([
            { label: "Material", key: "materialName" },
          ], d.materialShortages, { emptyText: "All materials have available stock." })}</div>
        </div>`;
    }

    if (tab === "quality") {
      return `
        <div class="kpi-grid">
          <div class="kpi-card accent-warning"><div class="kpi-value">${fmtNum(d.openHolds, 0)}</div><div class="kpi-label">Open quality holds</div></div>
          <div class="kpi-card ${d.rejectedBatchRate ? "accent-warning" : "accent-success"}"><div class="kpi-value">${rate(d.rejectedBatchRate)}</div><div class="kpi-label">Rejected material batch rate</div></div>
        </div>
        <div class="grid-2">
          <div class="card"><h3>Defects by severity</h3>${countTable(d.defectsBySeverity, "No defects recorded.")}</div>
          <div class="card"><h3>Defects by category</h3>${countTable(d.defectsByCategory, "No defects recorded.")}</div>
        </div>
        <div class="card"><h3>NCRs by status</h3>${countTable(d.ncrsByStatus, "No NCRs recorded.")}</div>`;
    }

    return `
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-value">${fmtNum(d.productBatchCount, 0)}</div><div class="kpi-label">Product batches</div></div>
        <div class="kpi-card"><div class="kpi-value">${fmtNum(d.materialBatchCount, 0)}</div><div class="kpi-label">Material batches</div></div>
        <div class="kpi-card ${d.scrapRate ? "accent-warning" : "accent-success"}"><div class="kpi-value">${rate(d.scrapRate)}</div><div class="kpi-label">Scrap rate</div></div>
        <div class="kpi-card ${d.incidentCount ? "accent-warning" : "accent-success"}"><div class="kpi-value">${fmtNum(d.incidentCount, 0)}</div><div class="kpi-label">Recorded incidents</div></div>
      </div>
      <div class="card"><h3>What this report covers</h3><p class="muted">Batch counts, material-to-product traceability coverage, scrap, and related production incidents.</p></div>`;
  },

  // ---------------- System Configuration ----------------

  async settings() {
    const d = await Api.get("/v1/settings");
    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="page-header"><h2>System Configuration</h2></div>
      <p class="flow-note">The "configurable, not hard-coded" thresholds from Sections 29, 35, 36, 44, 46.</p>
      <div class="card">
        <form id="settings-form">
          <div class="form-grid">
            ${Object.entries(d.settings).map(([k, v]) => `<div class="field"><label>${esc(k)}</label><input name="${esc(k)}" value="${esc(v)}" /></div>`).join("")}
          </div>
          <button class="btn btn-primary" style="margin-top:14px" type="submit">Save Settings</button>
        </form>
      </div>
    `;
    document.getElementById("settings-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      try { await Api.patch("/v1/settings", formToObject(e.target)); toast("Settings updated.", "success"); }
      catch (err) { notifyError(err); }
    });
  },
};
window.Views = Views;
