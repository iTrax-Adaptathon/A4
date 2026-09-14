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

    // Role Metadata (monogram & accent color)
    const ROLE_METAS = {
      SYSTEM_ADMIN: { monogram: "SA", color: "#4f46e5" },
      PRODUCTION_MANAGER: { monogram: "PM", color: "#2563eb" },
      SUPERVISOR: { monogram: "SV", color: "#0284c7" },
      QA_QC_OFFICER: { monogram: "QA", color: "#059669" },
      MAINTENANCE_OFFICER: { monogram: "MO", color: "#d97706" },
      OPERATOR: { monogram: "OP", color: "#7c3aed" },
    };

    const getRoleMeta = (id, name) => {
      if (ROLE_METAS[id]) return ROLE_METAS[id];
      const mono = (name || id || "RO").split(/[\s_]+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
      return { monogram: mono, color: "var(--primary)" };
    };

    // State Tracking
    const rolePerms = new Map();
    const savedPerms = new Map();
    rolesResp.items.forEach((r) => {
      const perms = new Set(r.permissions || []);
      rolePerms.set(r.id, new Set(perms));
      savedPerms.set(r.id, new Set(perms));
    });

    let activeRoleId = (this._activeRoleId && rolesResp.items.some((r) => r.id === this._activeRoleId))
      ? this._activeRoleId
      : (rolesResp.items[0] ? rolesResp.items[0].id : "");

    let activeFilter = "all"; // 'all' | 'granted' | 'revoked'
    let searchQuery = "";
    let activeView = "detail"; // 'detail' | 'matrix'
    const expandedCategories = new Set(CATEGORIES.map((c) => c.id));

    // Render Main Shell
    content.innerHTML = `
      <div class="roles-view-container">
        <!-- Header & View Switcher -->
        <div class="roles-view-header">
          <div class="roles-title-group">
            <h2>Roles &amp; Permissions</h2>
            <p>Configure role-based access control (RBAC), privilege boundaries, and operational authority.</p>
          </div>
          <div class="roles-view-toggle-wrap">
            <div class="segmented-control" id="roles-view-switcher">
              <button type="button" class="segmented-btn active" data-view="detail">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                <span>Role Permissions</span>
              </button>
              <button type="button" class="segmented-btn" data-view="matrix">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
                <span>Comparison Matrix</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Master-Detail View (Default) -->
        <div class="roles-master-detail" id="roles-detail-view">
          <!-- Left Rail: Roles -->
          <aside class="roles-master-rail">
            <div class="rail-header">
              <span class="rail-header-title">System Roles</span>
              <span class="badge badge-primary" style="font-size: 11px;">${rolesResp.items.length} Roles</span>
            </div>
            <div class="roles-rail-list" id="roles-rail-list"></div>
          </aside>

          <!-- Right Workspace: Active Role Permissions -->
          <main class="roles-workspace" id="roles-workspace"></main>
        </div>

        <!-- Side-by-Side Comparison Matrix View -->
        <div class="roles-matrix-card" id="roles-matrix-view" style="display: none;"></div>
      </div>
    `;

    // Helpers
    const getActiveRole = () => rolesResp.items.find((r) => r.id === activeRoleId) || rolesResp.items[0];

    const isDirty = (roleId) => {
      const current = rolePerms.get(roleId);
      const original = savedPerms.get(roleId);
      if (!current || !original) return false;
      if (current.size !== original.size) return true;
      for (const code of current) {
        if (!original.has(code)) return true;
      }
      return false;
    };

    // Render Left Rail List
    const renderRailList = () => {
      const railList = document.getElementById("roles-rail-list");
      if (!railList) return;

      railList.innerHTML = rolesResp.items.map((r) => {
        const meta = getRoleMeta(r.id, r.name);
        const assigned = rolePerms.get(r.id) ? rolePerms.get(r.id).size : 0;
        const percent = Math.round((assigned / totalPermsCount) * 100);
        const isActive = r.id === activeRoleId;
        const dirty = isDirty(r.id);

        return `
          <button type="button" class="role-rail-item ${isActive ? "active" : ""}" data-rail-role="${r.id}">
            <div class="role-rail-monogram" style="background: ${meta.color};">${meta.monogram}</div>
            <div class="role-rail-info">
              <div class="role-rail-top">
                <span class="role-rail-name">${esc(r.name)}${dirty ? ` <span style="color: var(--warning);" title="Unsaved changes">*</span>` : ""}</span>
                <span class="role-rail-count">${assigned}/${totalPermsCount}</span>
              </div>
              <div class="role-rail-bar-track">
                <div class="role-rail-bar-fill" style="width: ${percent}%;"></div>
              </div>
            </div>
          </button>
        `;
      }).join("");

      railList.querySelectorAll(".role-rail-item").forEach((btn) => {
        btn.addEventListener("click", () => {
          const roleId = btn.dataset.railRole;
          if (roleId === activeRoleId) return;
          activeRoleId = roleId;
          this._activeRoleId = roleId;
          renderRailList();
          renderWorkspace();
        });
      });
    };

    // Render Workspace
    const renderWorkspace = () => {
      const workspace = document.getElementById("roles-workspace");
      if (!workspace) return;

      const role = getActiveRole();
      if (!role) return;

      const meta = getRoleMeta(role.id, role.name);
      const currentSet = rolePerms.get(role.id) || new Set();
      const assignedCount = currentSet.size;
      const percent = Math.round((assignedCount / totalPermsCount) * 100);
      const dirty = isDirty(role.id);

      workspace.innerHTML = `
        <!-- Hero Overview Banner -->
        <div class="role-workspace-hero">
          <div class="hero-main-row">
            <div class="hero-role-badge-row">
              <div class="hero-role-monogram" style="background: ${meta.color};">${meta.monogram}</div>
              <div class="hero-role-headings">
                <div class="hero-title-line">
                  <h3 id="hero-role-title">${esc(role.name)}</h3>
                  <span class="badge ${assignedCount === totalPermsCount ? "badge-green" : "badge-primary"}" id="hero-role-badge">
                    ${assignedCount} of ${totalPermsCount} Granted (${percent}%)
                  </span>
                </div>
                <p class="hero-role-desc">${esc(role.description || "System functional role.")}</p>
              </div>
            </div>
            <div class="hero-role-actions">
              <button type="button" class="btn btn-sm btn-ghost" id="btn-select-all" title="Grant all permissions">Select All</button>
              <button type="button" class="btn btn-sm btn-ghost" id="btn-clear-all" title="Deselect all permissions">Deselect All</button>
              <button type="button" class="btn btn-sm ${dirty ? "btn-warning" : "btn-primary"}" id="btn-save-role">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                <span id="save-btn-label">${dirty ? "Save Changes *" : "Save Permissions"}</span>
              </button>
            </div>
          </div>
          <div class="hero-progress-wrap">
            <div class="hero-progress-track">
              <div class="hero-progress-bar" id="hero-progress-fill" style="width: ${percent}%;"></div>
            </div>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="roles-toolbar-card">
          <div class="toolbar-search-wrap">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" id="role-perm-search" placeholder="Search permissions (e.g. 'orders', 'hold', 'batch')..." value="${esc(searchQuery)}" autocomplete="off" />
            <button type="button" class="toolbar-search-clear" id="role-search-clear" style="display: ${searchQuery ? "block" : "none"};">&times;</button>
          </div>

          <div class="toolbar-controls-row">
            <!-- Status Filter Segmented Control -->
            <div class="status-segment-group" id="status-filter-group">
              <button type="button" class="status-pill-btn ${activeFilter === "all" ? "active" : ""}" data-status="all">
                All <span class="pill-count" id="count-pill-all">${totalPermsCount}</span>
              </button>
              <button type="button" class="status-pill-btn ${activeFilter === "granted" ? "active" : ""}" data-status="granted">
                Granted <span class="pill-count" id="count-pill-granted">${assignedCount}</span>
              </button>
              <button type="button" class="status-pill-btn ${activeFilter === "revoked" ? "active" : ""}" data-status="revoked">
                Not Granted <span class="pill-count" id="count-pill-revoked">${totalPermsCount - assignedCount}</span>
              </button>
            </div>

            <!-- Global Accordion Controls -->
            <div class="accordion-global-controls">
              <button type="button" class="link-btn" id="btn-expand-all">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 11 12 6 17 11"></polyline><polyline points="7 18 12 13 17 18"></polyline></svg>
                Expand All
              </button>
              <span class="control-sep">|</span>
              <button type="button" class="link-btn" id="btn-collapse-all">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 13 12 18 17 13"></polyline><polyline points="7 6 12 11 17 6"></polyline></svg>
                Collapse All
              </button>
            </div>
          </div>
        </div>

        <!-- Collapsible Category Accordions -->
        <div class="role-accordions-container" id="categories-accordion-container">
          ${CATEGORIES.map((cat) => {
            const catPerms = cat.codes.map((c) => permMap.get(c)).filter(Boolean);
            if (!catPerms.length) return "";
            const catGranted = catPerms.filter((p) => currentSet.has(p.code)).length;
            const isExpanded = expandedCategories.has(cat.id);
            const statusClass = catGranted === catPerms.length
              ? "all-granted"
              : catGranted > 0
                ? "partial-granted"
                : "none-granted";

            return `
              <div class="category-accordion-card ${isExpanded ? "expanded" : ""}" data-accordion-cat="${cat.id}">
                <div class="category-accordion-header" data-toggle-header="${cat.id}">
                  <div class="cat-header-left">
                    <span class="cat-chevron">
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </span>
                    <div class="cat-icon-wrap">${cat.icon}</div>
                    <div class="cat-title-wrap">
                      <span class="cat-title-text">${esc(cat.name)}</span>
                      <span class="cat-status-badge ${statusClass}" id="cat-badge-${cat.id}">
                        ${catGranted}/${catPerms.length} Granted
                      </span>
                    </div>
                  </div>
                  <div class="cat-header-right">
                    <button type="button" class="cat-quick-btn" data-cat-grant="${cat.id}" title="Grant all in ${esc(cat.name)}">Grant All</button>
                    <button type="button" class="cat-quick-btn" data-cat-revoke="${cat.id}" title="Revoke all in ${esc(cat.name)}">Revoke</button>
                  </div>
                </div>

                <div class="category-accordion-content" id="cat-content-${cat.id}" style="${isExpanded ? "display: block;" : "display: none;"}">
                  <div class="category-perm-list">
                    ${catPerms.map((p) => {
                      const isGranted = currentSet.has(p.code);
                      return `
                        <div class="perm-row ${isGranted ? "granted" : ""}" data-perm-code="${esc(p.code)}" data-perm-desc="${esc((p.description || '').toLowerCase())}">
                          <div class="perm-left">
                            <div class="perm-title-line">
                              <span class="perm-code">${esc(p.code)}</span>
                            </div>
                            <span class="perm-desc">${esc(p.description || "")}</span>
                          </div>
                          <div class="perm-right">
                            <label class="switch-control" title="${isGranted ? "Granted" : "Not granted"}">
                              <input type="checkbox" class="perm-switch" data-code="${esc(p.code)}" ${isGranted ? "checked" : ""} />
                              <span class="switch-slider"></span>
                            </label>
                          </div>
                        </div>
                      `;
                    }).join("")}
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;

      // Apply initial filter / search states to rows
      applyFilterAndSearch();
      bindWorkspaceEvents();
    };

    // Update active counters and visual badges
    const updateWorkspaceStats = () => {
      const role = getActiveRole();
      if (!role) return;

      const currentSet = rolePerms.get(role.id) || new Set();
      const assignedCount = currentSet.size;
      const percent = Math.round((assignedCount / totalPermsCount) * 100);
      const dirty = isDirty(role.id);

      // Hero badges & bars
      const badge = document.getElementById("hero-role-badge");
      if (badge) {
        badge.textContent = `${assignedCount} of ${totalPermsCount} Granted (${percent}%)`;
        badge.className = `badge ${assignedCount === totalPermsCount ? "badge-green" : "badge-primary"}`;
      }
      const fill = document.getElementById("hero-progress-fill");
      if (fill) fill.style.width = `${percent}%`;

      // Status pill counts
      const pillGranted = document.getElementById("count-pill-granted");
      if (pillGranted) pillGranted.textContent = assignedCount;
      const pillRevoked = document.getElementById("count-pill-revoked");
      if (pillRevoked) pillRevoked.textContent = totalPermsCount - assignedCount;

      // Save button state
      const saveBtn = document.getElementById("btn-save-role");
      const saveLabel = document.getElementById("save-btn-label");
      if (saveBtn && saveLabel) {
        saveBtn.className = `btn btn-sm ${dirty ? "btn-warning" : "btn-primary"}`;
        saveLabel.textContent = dirty ? "Save Changes *" : "Save Permissions";
      }

      // Update category badges
      CATEGORIES.forEach((cat) => {
        const catPerms = cat.codes.map((c) => permMap.get(c)).filter(Boolean);
        const catGranted = catPerms.filter((p) => currentSet.has(p.code)).length;
        const catBadge = document.getElementById(`cat-badge-${cat.id}`);
        if (catBadge) {
          catBadge.textContent = `${catGranted}/${catPerms.length} Granted`;
          catBadge.className = `cat-status-badge ${
            catGranted === catPerms.length ? "all-granted" : catGranted > 0 ? "partial-granted" : "none-granted"
          }`;
        }
      });

      // Update Left Rail without re-rendering entire rail
      renderRailList();
    };

    // Filter & Search Logic
    const applyFilterAndSearch = () => {
      const query = searchQuery.trim().toLowerCase();
      const role = getActiveRole();
      if (!role) return;
      const currentSet = rolePerms.get(role.id) || new Set();

      document.querySelectorAll(".category-accordion-card").forEach((card) => {
        const catId = card.dataset.accordionCat;
        let visibleRows = 0;

        card.querySelectorAll(".perm-row").forEach((row) => {
          const code = row.dataset.permCode;
          const desc = row.dataset.permDesc;
          const isGranted = currentSet.has(code);

          // Check Status Filter
          let statusMatch = true;
          if (activeFilter === "granted") statusMatch = isGranted;
          else if (activeFilter === "revoked") statusMatch = !isGranted;

          // Check Search Query
          let queryMatch = true;
          if (query) {
            queryMatch = code.toLowerCase().includes(query) || desc.includes(query);
          }

          const isVisible = statusMatch && queryMatch;
          row.style.display = isVisible ? "flex" : "none";
          if (isVisible) visibleRows++;
        });

        // Hide whole category if no permissions match
        card.style.display = visibleRows > 0 ? "flex" : "none";

        // If searching with active query and category has matches, auto-expand it
        if (query && visibleRows > 0) {
          expandedCategories.add(catId);
          card.classList.add("expanded");
          const contentEl = document.getElementById(`cat-content-${catId}`);
          if (contentEl) contentEl.style.display = "block";
        }
      });
    };

    // Workspace Event Bindings
    const bindWorkspaceEvents = () => {
      const role = getActiveRole();
      if (!role) return;

      // Accordion header click to expand / collapse
      document.querySelectorAll("[data-toggle-header]").forEach((header) => {
        header.addEventListener("click", (e) => {
          // If clicked inside quick-actions, ignore
          if (e.target.closest(".cat-header-right")) return;
          const catId = header.dataset.toggleHeader;
          const card = header.closest(".category-accordion-card");
          const contentEl = document.getElementById(`cat-content-${catId}`);
          if (!card || !contentEl) return;

          const isCurrentlyExpanded = card.classList.contains("expanded");
          if (isCurrentlyExpanded) {
            card.classList.remove("expanded");
            contentEl.style.display = "none";
            expandedCategories.delete(catId);
          } else {
            card.classList.add("expanded");
            contentEl.style.display = "block";
            expandedCategories.add(catId);
          }
        });
      });

      // Permission Row click & switch change handler
      document.querySelectorAll(".perm-row").forEach((row) => {
        row.addEventListener("click", (e) => {
          // Prevent double toggle if switch itself was clicked
          if (e.target.tagName === "INPUT" || e.target.classList.contains("switch-slider")) return;
          const sw = row.querySelector(".perm-switch");
          if (sw) {
            sw.checked = !sw.checked;
            sw.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
      });

      document.querySelectorAll(".perm-switch").forEach((sw) => {
        sw.addEventListener("change", () => {
          const code = sw.dataset.code;
          const row = sw.closest(".perm-row");
          const currentSet = rolePerms.get(role.id);
          if (!currentSet) return;

          if (sw.checked) {
            currentSet.add(code);
            if (row) row.classList.add("granted");
          } else {
            currentSet.delete(code);
            if (row) row.classList.remove("granted");
          }

          updateWorkspaceStats();
          if (activeFilter !== "all") {
            applyFilterAndSearch();
          }
        });
      });

      // Category Quick Actions
      document.querySelectorAll("[data-cat-grant]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const catId = btn.dataset.catGrant;
          const cat = CATEGORIES.find((c) => c.id === catId);
          if (!cat) return;
          const currentSet = rolePerms.get(role.id);
          if (!currentSet) return;

          cat.codes.forEach((code) => {
            if (permMap.has(code)) {
              currentSet.add(code);
              const row = document.querySelector(`.perm-row[data-perm-code="${code}"]`);
              if (row) {
                row.classList.add("granted");
                const sw = row.querySelector(".perm-switch");
                if (sw) sw.checked = true;
              }
            }
          });

          updateWorkspaceStats();
          if (activeFilter !== "all") applyFilterAndSearch();
        });
      });

      document.querySelectorAll("[data-cat-revoke]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const catId = btn.dataset.catRevoke;
          const cat = CATEGORIES.find((c) => c.id === catId);
          if (!cat) return;
          const currentSet = rolePerms.get(role.id);
          if (!currentSet) return;

          cat.codes.forEach((code) => {
            currentSet.delete(code);
            const row = document.querySelector(`.perm-row[data-perm-code="${code}"]`);
            if (row) {
              row.classList.remove("granted");
              const sw = row.querySelector(".perm-switch");
              if (sw) sw.checked = false;
            }
          });

          updateWorkspaceStats();
          if (activeFilter !== "all") applyFilterAndSearch();
        });
      });

      // Select All / Deselect All
      const selectAllBtn = document.getElementById("btn-select-all");
      if (selectAllBtn) {
        selectAllBtn.addEventListener("click", () => {
          const currentSet = rolePerms.get(role.id);
          if (!currentSet) return;
          permsResp.items.forEach((p) => currentSet.add(p.code));
          document.querySelectorAll(".perm-row").forEach((row) => {
            row.classList.add("granted");
            const sw = row.querySelector(".perm-switch");
            if (sw) sw.checked = true;
          });
          updateWorkspaceStats();
          if (activeFilter !== "all") applyFilterAndSearch();
        });
      }

      const clearAllBtn = document.getElementById("btn-clear-all");
      if (clearAllBtn) {
        clearAllBtn.addEventListener("click", () => {
          const currentSet = rolePerms.get(role.id);
          if (!currentSet) return;
          currentSet.clear();
          document.querySelectorAll(".perm-row").forEach((row) => {
            row.classList.remove("granted");
            const sw = row.querySelector(".perm-switch");
            if (sw) sw.checked = false;
          });
          updateWorkspaceStats();
          if (activeFilter !== "all") applyFilterAndSearch();
        });
      }

      // Expand All / Collapse All
      const expandAllBtn = document.getElementById("btn-expand-all");
      if (expandAllBtn) {
        expandAllBtn.addEventListener("click", () => {
          CATEGORIES.forEach((c) => expandedCategories.add(c.id));
          document.querySelectorAll(".category-accordion-card").forEach((card) => {
            card.classList.add("expanded");
            const contentEl = card.querySelector(".category-accordion-content");
            if (contentEl) contentEl.style.display = "block";
          });
        });
      }

      const collapseAllBtn = document.getElementById("btn-collapse-all");
      if (collapseAllBtn) {
        collapseAllBtn.addEventListener("click", () => {
          expandedCategories.clear();
          document.querySelectorAll(".category-accordion-card").forEach((card) => {
            card.classList.remove("expanded");
            const contentEl = card.querySelector(".category-accordion-content");
            if (contentEl) contentEl.style.display = "none";
          });
        });
      }

      // Status Segment Buttons
      document.querySelectorAll("[data-status]").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeFilter = btn.dataset.status;
          document.querySelectorAll("[data-status]").forEach((b) => b.classList.toggle("active", b.dataset.status === activeFilter));
          applyFilterAndSearch();
        });
      });

      // Search Filter
      const searchInput = document.getElementById("role-perm-search");
      const searchClear = document.getElementById("role-search-clear");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          searchQuery = e.target.value;
          if (searchClear) searchClear.style.display = searchQuery ? "block" : "none";
          applyFilterAndSearch();
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
          applyFilterAndSearch();
        });
      }

      // Save Permissions Button
      const saveBtn = document.getElementById("btn-save-role");
      if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
          const codes = Array.from(rolePerms.get(role.id) || []);
          try {
            saveBtn.disabled = true;
            saveBtn.innerHTML = `<span>Saving...</span>`;
            await Api.patch(`/v1/roles/${role.id}/permissions`, { permissionCodes: codes });
            toast(`Permissions updated for ${role.name}.`, "success");
            savedPerms.set(role.id, new Set(codes));
            role.permissions = codes;
            updateWorkspaceStats();
          } catch (err) {
            notifyError(err);
          } finally {
            saveBtn.disabled = false;
            updateWorkspaceStats();
          }
        });
      }
    };

    // Render Side-by-Side Comparison Matrix
    const renderMatrixView = () => {
      const matrixCard = document.getElementById("roles-matrix-view");
      if (!matrixCard) return;

      matrixCard.innerHTML = `
        <div class="matrix-header-row">
          <div>
            <h3>Cross-Role Authorization Matrix</h3>
            <p class="muted" style="margin: 4px 0 0 0; font-size: 13px;">Full side-by-side comparison of role capabilities across all operational domains.</p>
          </div>
          <div class="matrix-legend">
            <span class="legend-item"><span class="matrix-icon-check"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></span> Granted</span>
            <span class="legend-item"><span class="matrix-icon-dash">—</span> Restricted</span>
          </div>
        </div>

        <div class="matrix-table-wrap">
          <table class="matrix-table">
            <thead>
              <tr>
                <th class="col-permission">Permission Domain &amp; Code</th>
                ${rolesResp.items.map((r) => {
                  const meta = getRoleMeta(r.id, r.name);
                  const assigned = (r.permissions || []).length;
                  return `
                    <th class="col-role">
                      <div class="matrix-th-role">
                        <span class="matrix-th-mono" style="background: ${meta.color};">${meta.monogram}</span>
                        <span class="matrix-th-title">${esc(r.name)}</span>
                        <span class="matrix-th-count">${assigned}/${totalPermsCount}</span>
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
                  <tr class="matrix-cat-row">
                    <td colspan="${rolesResp.items.length + 1}">
                      <div class="matrix-cat-title">
                        ${cat.icon}
                        <span>${esc(cat.name)}</span>
                        <span class="muted" style="font-weight: normal; font-size: 11.5px;">(${catPerms.length} permissions)</span>
                      </div>
                    </td>
                  </tr>
                  ${catPerms.map((p) => `
                    <tr class="matrix-perm-row">
                      <td class="col-permission">
                        <div class="matrix-perm-info">
                          <span class="matrix-perm-code">${esc(p.code)}</span>
                          <span class="matrix-perm-desc">${esc(p.description || "")}</span>
                        </div>
                      </td>
                      ${rolesResp.items.map((r) => {
                        const hasPerm = (r.permissions || []).includes(p.code);
                        return `
                          <td class="col-role-cell">
                            ${hasPerm
                              ? `<span class="matrix-pill granted" title="Granted to ${esc(r.name)}"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></span>`
                              : `<span class="matrix-pill restricted" title="Restricted">—</span>`
                            }
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
      `;
    };

    // View Switcher (Detail vs Matrix)
    document.querySelectorAll("#roles-view-switcher [data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;
        if (view === activeView) return;
        activeView = view;

        document.querySelectorAll("#roles-view-switcher [data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === activeView));

        const detailView = document.getElementById("roles-detail-view");
        const matrixView = document.getElementById("roles-matrix-view");

        if (activeView === "detail") {
          if (detailView) detailView.style.display = "grid";
          if (matrixView) matrixView.style.display = "none";
          renderRailList();
          renderWorkspace();
        } else {
          if (detailView) detailView.style.display = "none";
          if (matrixView) matrixView.style.display = "flex";
          renderMatrixView();
        }
      });
    });

    // Initial Render
    renderRailList();
    renderWorkspace();
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
