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
        icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
        codes: ["MANAGE_USERS", "MANAGE_ROLES", "MANAGE_SYSTEM_SETTINGS", "ADMIN_SEARCH"]
      },
      {
        id: "production",
        name: "Production & Planning",
        icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon><line x1="19" y1="12" x2="5" y2="12"></line></svg>`,
        codes: ["CREATE_ORDERS", "APPROVE_ORDERS", "VIEW_ORDERS", "ALLOCATE_RESOURCES", "EXECUTE_PRODUCTION", "VIEW_PRODUCTION", "MANAGE_PROCESSES", "VIEW_PROCESSES"]
      },
      {
        id: "resources",
        name: "Resources & Equipment",
        icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`,
        codes: ["MANAGE_MACHINES", "VIEW_MACHINES", "MANAGE_MATERIALS", "VIEW_MATERIALS", "MANAGE_SUPPLIERS", "MANAGE_MAINTENANCE", "VIEW_MAINTENANCE", "REPORT_MAINTENANCE"]
      },
      {
        id: "quality",
        name: "Quality & Compliance",
        icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
        codes: ["INSPECT_BATCH", "VIEW_QUALITY", "CREATE_DEFECT", "REPORT_QUALITY_DEFECT", "CREATE_HOLD", "REQUEST_HOLD", "RELEASE_HOLD", "CREATE_NCR"]
      },
      {
        id: "monitoring",
        name: "Monitoring & Operations",
        icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`,
        codes: ["MANAGE_INCIDENTS", "REPORT_INCIDENTS", "MANAGE_ALERTS", "VIEW_RISK", "CREATE_OVERRIDE", "APPROVE_OVERRIDE"]
      },
      {
        id: "traceability",
        name: "Traceability & Genealogy",
        icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`,
        codes: ["VIEW_TRACEABILITY_ALL", "VIEW_TRACEABILITY_LIMITED"]
      },
      {
        id: "audit",
        name: "Audit & Reporting",
        icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
        codes: ["VIEW_AUDIT_LOG_ALL", "VIEW_AUDIT_LOG_LIMITED", "VIEW_AUDIT_LOG_OWN", "VIEW_REPORTS"]
      }
    ];

    const permMap = new Map();
    permsResp.items.forEach((p) => permMap.set(p.code, p));

    const mappedCodes = new Set(CATEGORIES.flatMap((c) => c.codes));
    const extraPerms = permsResp.items.filter((p) => !mappedCodes.has(p.code));
    if (extraPerms.length > 0) {
      CATEGORIES.push({
        id: "other",
        name: "Other Permissions",
        icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line></svg>`,
        codes: extraPerms.map((p) => p.code)
      });
    }

    const totalPermsCount = permsResp.items.length;

    const ROLE_METAS = {
      SYSTEM_ADMIN: { label: "Admin", dot: "#4f46e5" },
      PRODUCTION_MANAGER: { label: "Prod Mgr", dot: "#2563eb" },
      SUPERVISOR: { label: "Supervisor", dot: "#0284c7" },
      QA_QC_OFFICER: { label: "QA Officer", dot: "#059669" },
      MAINTENANCE_OFFICER: { label: "Maintenance", dot: "#d97706" },
      OPERATOR: { label: "Operator", dot: "#7c3aed" },
    };

    const getRoleMeta = (id, name) => {
      if (ROLE_METAS[id]) return ROLE_METAS[id];
      return { label: name || id, dot: "var(--primary)" };
    };

    // State Tracking
    const rolePerms = new Map();
    const savedPerms = new Map();
    rolesResp.items.forEach((r) => {
      const perms = new Set(r.permissions || []);
      rolePerms.set(r.id, new Set(perms));
      savedPerms.set(r.id, new Set(perms));
    });

    let currentTab = "matrix"; // "matrix" or role ID
    let searchQuery = "";

    const getDirtyRoles = () => {
      const dirty = [];
      rolesResp.items.forEach((r) => {
        const cur = rolePerms.get(r.id);
        const orig = savedPerms.get(r.id);
        if (!cur || !orig) return;
        if (cur.size !== orig.size) {
          dirty.push(r.id);
          return;
        }
        for (const code of cur) {
          if (!orig.has(code)) {
            dirty.push(r.id);
            return;
          }
        }
      });
      return dirty;
    };

    // Render Shell
    content.innerHTML = `
      <div class="roles-view-container">
        <!-- Compact Top Bar -->
        <div class="roles-top-bar">
          <div class="roles-title-compact">
            <h2>Roles &amp; Permissions</h2>
            <span class="badge badge-primary">${totalPermsCount} Permissions</span>
          </div>

          <!-- View / Role Tabs -->
          <div class="roles-nav-tabs" id="roles-nav-tabs">
            <button type="button" class="role-nav-tab ${currentTab === "matrix" ? "active" : ""}" data-tab="matrix">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
              <span>Full Matrix</span>
            </button>
            ${rolesResp.items.map((r) => {
              const meta = getRoleMeta(r.id, r.name);
              const count = rolePerms.get(r.id) ? rolePerms.get(r.id).size : 0;
              return `
                <button type="button" class="role-nav-tab ${currentTab === r.id ? "active" : ""}" data-tab="${r.id}">
                  <span class="tab-dot" style="background: ${meta.dot};"></span>
                  <span>${esc(meta.label)}</span>
                  <span class="tab-count" id="tab-count-${r.id}">${count}</span>
                </button>
              `;
            }).join("")}
          </div>

          <!-- Top Actions -->
          <div class="roles-top-actions">
            <div class="roles-search-box">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" id="roles-search-input" placeholder="Filter permissions..." value="${esc(searchQuery)}" autocomplete="off" />
              <button type="button" class="roles-search-clear" id="roles-search-clear" style="display: ${searchQuery ? "block" : "none"};">&times;</button>
            </div>
            <button type="button" class="btn btn-sm btn-primary" id="roles-save-btn">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              <span id="roles-save-text">Save Changes</span>
            </button>
          </div>
        </div>

        <!-- Main Body: Matrix or Single Role -->
        <div id="roles-body-view"></div>
      </div>
    `;

    // Render Matrix Mode
    const renderMatrix = () => {
      const body = document.getElementById("roles-body-view");
      if (!body) return;

      body.innerHTML = `
        <div class="matrix-container-card">
          <div class="matrix-scroll-pane">
            <table class="matrix-table-dense">
              <thead>
                <tr>
                  <th class="col-perm-name">Permission Code &amp; Function</th>
                  ${rolesResp.items.map((r) => {
                    const meta = getRoleMeta(r.id, r.name);
                    const assigned = rolePerms.get(r.id) ? rolePerms.get(r.id).size : 0;
                    return `
                      <th class="col-role-header" data-col-role="${r.id}">
                        <div class="role-header-content">
                          <span class="role-header-pill">
                            <span class="role-dot" style="background: ${meta.dot};"></span>
                            <span>${esc(meta.label)}</span>
                          </span>
                          <div class="role-header-meta">
                            <span class="role-header-count" id="matrix-col-count-${r.id}">${assigned}/${totalPermsCount}</span>
                            <button type="button" class="role-col-toggle" data-toggle-col="${r.id}" title="Toggle all permissions for ${esc(meta.label)}">toggle</button>
                          </div>
                        </div>
                      </th>
                    `;
                  }).join("")}
                </tr>
              </thead>
              <tbody>
                ${CATEGORIES.map((cat) => {
                  const catPerms = cat.codes.map((c) => permMap.get(c)).filter(Boolean);
                  if (!catPerms.length) return "";

                  return `
                    <tr class="matrix-cat-section-row" data-cat-section="${cat.id}">
                      <td colspan="${rolesResp.items.length + 1}">
                        <div class="matrix-cat-section-content">
                          <span class="matrix-cat-label">
                            ${cat.icon}
                            <span>${esc(cat.name)}</span>
                            <span class="matrix-cat-count">(${catPerms.length} permissions)</span>
                          </span>
                        </div>
                      </td>
                    </tr>
                    ${catPerms.map((p) => `
                      <tr class="matrix-row-dense" data-perm-code="${esc(p.code)}" data-perm-desc="${esc((p.description || '').toLowerCase())}" data-cat-parent="${cat.id}">
                        <td class="col-perm-name">
                          <div class="perm-cell-content" title="${esc(p.description || '')}">
                            <span class="perm-code-bold">${esc(p.code)}</span>
                            <span class="perm-desc-inline">${esc(p.description || "")}</span>
                          </div>
                        </td>
                        ${rolesResp.items.map((r) => {
                          const has = rolePerms.get(r.id) ? rolePerms.get(r.id).has(p.code) : false;
                          return `
                            <td class="col-role-cell" data-cell-role="${r.id}" data-cell-code="${esc(p.code)}">
                              <button type="button" class="matrix-check-btn ${has ? "checked" : ""}" data-role-id="${r.id}" data-perm-code="${esc(p.code)}" title="${has ? "Revoke" : "Grant"} ${esc(p.code)} for ${esc(r.name)}">
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                              </button>
                            </td>
                          `;
                        }).join("")}
                      </tr>
                    `).join("")}
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Matrix Cell Click Handlers
      body.querySelectorAll(".matrix-check-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const roleId = btn.dataset.roleId;
          const code = btn.dataset.permCode;
          const currentSet = rolePerms.get(roleId);
          if (!currentSet) return;

          if (currentSet.has(code)) {
            currentSet.delete(code);
            btn.classList.remove("checked");
          } else {
            currentSet.add(code);
            btn.classList.add("checked");
          }

          updateCounters();
        });
      });

      // Role Column Toggle All
      body.querySelectorAll("[data-toggle-col]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const roleId = btn.dataset.toggleCol;
          const currentSet = rolePerms.get(roleId);
          if (!currentSet) return;

          const allActive = permsResp.items.every((p) => currentSet.has(p.code));
          if (allActive) {
            currentSet.clear();
          } else {
            permsResp.items.forEach((p) => currentSet.add(p.code));
          }

          // Update column buttons in table
          body.querySelectorAll(`.matrix-check-btn[data-role-id="${roleId}"]`).forEach((b) => {
            b.classList.toggle("checked", !allActive);
          });

          updateCounters();
        });
      });

      applySearchFilter();
    };

    // Render Single Role Dense Mode
    const renderSingleRole = (roleId) => {
      const body = document.getElementById("roles-body-view");
      if (!body) return;

      const role = rolesResp.items.find((r) => r.id === roleId) || rolesResp.items[0];
      const meta = getRoleMeta(role.id, role.name);
      const currentSet = rolePerms.get(role.id) || new Set();
      const assigned = currentSet.size;

      body.innerHTML = `
        <div class="single-role-dense-container">
          <div class="single-role-hero-bar">
            <div class="single-role-hero-left">
              <span class="single-role-dot-badge" style="background: ${meta.dot};"></span>
              <div>
                <div class="single-role-title-line">
                  <h3>${esc(role.name)}</h3>
                  <span class="badge badge-primary" id="single-role-badge">${assigned} of ${totalPermsCount} granted (${Math.round((assigned / totalPermsCount) * 100)}%)</span>
                </div>
                <p class="single-role-hero-desc">${esc(role.description || "System functional role.")}</p>
              </div>
            </div>
            <div class="single-role-hero-right">
              <button type="button" class="btn btn-sm btn-ghost" id="single-select-all">Select All</button>
              <button type="button" class="btn btn-sm btn-ghost" id="single-clear-all">Deselect All</button>
            </div>
          </div>

          <div class="single-role-grid-dense">
            ${CATEGORIES.map((cat) => {
              const catPerms = cat.codes.map((c) => permMap.get(c)).filter(Boolean);
              if (!catPerms.length) return "";
              const catGranted = catPerms.filter((p) => currentSet.has(p.code)).length;

              return `
                <div class="single-role-cat-card" data-cat-card="${cat.id}">
                  <div class="single-role-cat-header">
                    <span class="single-role-cat-title">
                      ${cat.icon}
                      <span>${esc(cat.name)}</span>
                      <span class="muted" style="font-size: 11px;" id="single-cat-badge-${cat.id}">(${catGranted}/${catPerms.length})</span>
                    </span>
                    <div class="single-role-cat-actions">
                      <button type="button" class="link-btn" data-single-cat-toggle="${cat.id}" style="font-size: 11px;">Toggle</button>
                    </div>
                  </div>
                  <div class="single-role-perm-list">
                    ${catPerms.map((p) => {
                      const isChecked = currentSet.has(p.code);
                      return `
                        <label class="single-perm-row-dense ${isChecked ? "is-checked" : ""}" data-perm-code="${esc(p.code)}" data-perm-desc="${esc((p.description || '').toLowerCase())}">
                          <div class="single-perm-info">
                            <span class="single-perm-code">${esc(p.code)}</span>
                            <span class="single-perm-desc">${esc(p.description || "")}</span>
                          </div>
                          <input type="checkbox" class="compact-check" data-perm-code="${esc(p.code)}" ${isChecked ? "checked" : ""} />
                        </label>
                      `;
                    }).join("")}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;

      // Single Mode Event Handlers
      body.querySelectorAll(".compact-check").forEach((cb) => {
        cb.addEventListener("change", () => {
          const code = cb.dataset.permCode;
          const row = cb.closest(".single-perm-row-dense");
          if (cb.checked) {
            currentSet.add(code);
            if (row) row.classList.add("is-checked");
          } else {
            currentSet.delete(code);
            if (row) row.classList.remove("is-checked");
          }
          updateCounters();
          updateSingleCategoryBadges(role.id);
        });
      });

      body.querySelectorAll("[data-single-cat-toggle]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const catId = btn.dataset.singleCatToggle;
          const cat = CATEGORIES.find((c) => c.id === catId);
          if (!cat) return;
          const allChecked = cat.codes.every((c) => currentSet.has(c));
          cat.codes.forEach((c) => {
            if (permMap.has(c)) {
              if (allChecked) currentSet.delete(c);
              else currentSet.add(c);
              const row = body.querySelector(`.single-perm-row-dense[data-perm-code="${c}"]`);
              if (row) {
                row.classList.toggle("is-checked", !allChecked);
                const cb = row.querySelector(".compact-check");
                if (cb) cb.checked = !allChecked;
              }
            }
          });
          updateCounters();
          updateSingleCategoryBadges(role.id);
        });
      });

      const selectAllBtn = document.getElementById("single-select-all");
      if (selectAllBtn) {
        selectAllBtn.addEventListener("click", () => {
          permsResp.items.forEach((p) => currentSet.add(p.code));
          body.querySelectorAll(".single-perm-row-dense").forEach((r) => r.classList.add("is-checked"));
          body.querySelectorAll(".compact-check").forEach((cb) => (cb.checked = true));
          updateCounters();
          updateSingleCategoryBadges(role.id);
        });
      }

      const clearAllBtn = document.getElementById("single-clear-all");
      if (clearAllBtn) {
        clearAllBtn.addEventListener("click", () => {
          currentSet.clear();
          body.querySelectorAll(".single-perm-row-dense").forEach((r) => r.classList.remove("is-checked"));
          body.querySelectorAll(".compact-check").forEach((cb) => (cb.checked = false));
          updateCounters();
          updateSingleCategoryBadges(role.id);
        });
      }

      applySearchFilter();
    };

    const updateSingleCategoryBadges = (roleId) => {
      const currentSet = rolePerms.get(roleId) || new Set();
      const assigned = currentSet.size;
      const badge = document.getElementById("single-role-badge");
      if (badge) {
        badge.textContent = `${assigned} of ${totalPermsCount} granted (${Math.round((assigned / totalPermsCount) * 100)}%)`;
      }
      CATEGORIES.forEach((cat) => {
        const catPerms = cat.codes.map((c) => permMap.get(c)).filter(Boolean);
        const catGranted = catPerms.filter((p) => currentSet.has(p.code)).length;
        const b = document.getElementById(`single-cat-badge-${cat.id}`);
        if (b) b.textContent = `(${catGranted}/${catPerms.length})`;
      });
    };

    // Update Counters & Save Button State across views
    const updateCounters = () => {
      // Update top tabs
      rolesResp.items.forEach((r) => {
        const count = rolePerms.get(r.id) ? rolePerms.get(r.id).size : 0;
        const tabCount = document.getElementById(`tab-count-${r.id}`);
        if (tabCount) tabCount.textContent = count;

        const colCount = document.getElementById(`matrix-col-count-${r.id}`);
        if (colCount) colCount.textContent = `${count}/${totalPermsCount}`;
      });

      // Update Save button dirty state
      const dirty = getDirtyRoles();
      const saveBtn = document.getElementById("roles-save-btn");
      const saveText = document.getElementById("roles-save-text");
      if (saveBtn && saveText) {
        if (dirty.length > 0) {
          saveBtn.className = "btn btn-sm btn-warning";
          saveText.textContent = `Save Changes (${dirty.length})`;
        } else {
          saveBtn.className = "btn btn-sm btn-primary";
          saveText.textContent = "Save Changes";
        }
      }
    };

    // Live Search Filter
    const applySearchFilter = () => {
      const q = searchQuery.trim().toLowerCase();

      if (currentTab === "matrix") {
        const body = document.getElementById("roles-body-view");
        if (!body) return;

        CATEGORIES.forEach((cat) => {
          let visibleCount = 0;
          body.querySelectorAll(`.matrix-row-dense[data-cat-parent="${cat.id}"]`).forEach((row) => {
            const code = row.dataset.permCode.toLowerCase();
            const desc = row.dataset.permDesc;
            const matches = !q || code.includes(q) || desc.includes(q);
            row.style.display = matches ? "table-row" : "none";
            if (matches) visibleCount++;
          });

          const sectionRow = body.querySelector(`.matrix-cat-section-row[data-cat-section="${cat.id}"]`);
          if (sectionRow) sectionRow.style.display = visibleCount > 0 ? "table-row" : "none";
        });
      } else {
        const body = document.getElementById("roles-body-view");
        if (!body) return;

        CATEGORIES.forEach((cat) => {
          let visibleCount = 0;
          const card = body.querySelector(`.single-role-cat-card[data-cat-card="${cat.id}"]`);
          if (!card) return;

          card.querySelectorAll(".single-perm-row-dense").forEach((row) => {
            const code = row.dataset.permCode.toLowerCase();
            const desc = row.dataset.permDesc;
            const matches = !q || code.includes(q) || desc.includes(q);
            row.style.display = matches ? "flex" : "none";
            if (matches) visibleCount++;
          });

          card.style.display = visibleCount > 0 ? "block" : "none";
        });
      }
    };

    // Switch Tabs
    document.querySelectorAll("#roles-nav-tabs [data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        if (tab === currentTab) return;
        currentTab = tab;

        document.querySelectorAll("#roles-nav-tabs [data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === currentTab));

        if (currentTab === "matrix") {
          renderMatrix();
        } else {
          renderSingleRole(currentTab);
        }
      });
    });

    // Search Input
    const searchInput = document.getElementById("roles-search-input");
    const searchClear = document.getElementById("roles-search-clear");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value;
        if (searchClear) searchClear.style.display = searchQuery ? "block" : "none";
        applySearchFilter();
      });
    }
    if (searchClear) {
      searchClear.addEventListener("click", () => {
        searchQuery = "";
        if (searchInput) {
          searchInput.value = "";
          searchInput.focus();
        }
        searchClear.style.display = "none";
        applySearchFilter();
      });
    }

    // Save Button Handler (Saves all dirty roles)
    const saveBtn = document.getElementById("roles-save-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const dirty = getDirtyRoles();
        if (dirty.length === 0) {
          toast("No changes to save.", "info");
          return;
        }

        try {
          saveBtn.disabled = true;
          saveBtn.innerHTML = `<span>Saving...</span>`;

          await Promise.all(dirty.map(async (roleId) => {
            const codes = Array.from(rolePerms.get(roleId) || []);
            await Api.patch(`/v1/roles/${roleId}/permissions`, { permissionCodes: codes });
            savedPerms.set(roleId, new Set(codes));
            const rObj = rolesResp.items.find((r) => r.id === roleId);
            if (rObj) rObj.permissions = codes;
          }));

          toast(`Permissions saved successfully for ${dirty.length} role${dirty.length > 1 ? "s" : ""}.`, "success");
          updateCounters();
        } catch (err) {
          notifyError(err);
        } finally {
          saveBtn.disabled = false;
          updateCounters();
        }
      });
    }

    // Initial View: Full Matrix
    renderMatrix();
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
