/* App shell: login flow, navigation (Section 48), router, dashboard,
   notifications, global search, theme management, and modern interactions. */

const Theme = {
  STORAGE_KEY: "pcts_theme",

  get current() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  },

  set(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(this.STORAGE_KEY, theme);
    this.updateIcons(theme);
  },

  toggle() {
    const next = this.current === "dark" ? "light" : "dark";
    this.set(next);
  },

  updateIcons(theme) {
    const isDark = theme === "dark";
    document.querySelectorAll(".theme-sun").forEach((el) => { el.hidden = isDark; });
    document.querySelectorAll(".theme-moon").forEach((el) => { el.hidden = !isDark; });
  },

  init() {
    this.set(this.current);
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        if (!localStorage.getItem(this.STORAGE_KEY)) {
          this.set(e.matches ? "dark" : "light");
        }
      });
    }
  },
};

const NAV_ICONS = {
  "dashboard": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
  "users": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
  "roles": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
  "orders": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
  "runs": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
  "scheduling": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
  "planning": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`,
  "machines": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`,
  "operators": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
  "materials": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
  "suppliers": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>`,
  "inspections": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
  "defects": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  "holds": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="10" y1="15" x2="10" y2="9"></line><line x1="14" y1="15" x2="14" y2="9"></line></svg>`,
  "ncr": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line></svg>`,
  "live": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`,
  "alerts": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
  "risks": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
  "incidents": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
  "overrides": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>`,
  "traceability": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`,
  "maintenance": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
  "reports": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
  "audit-logs": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
  "settings": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
};

const App = {
  pollHandle: null,

  init() {
    Theme.init();

    // Login and MFA form listeners
    document.getElementById("login-form").addEventListener("submit", (e) => this.onLoginSubmit(e));
    document.getElementById("mfa-form").addEventListener("submit", (e) => this.onMfaSubmit(e));
    document.getElementById("logout-btn").addEventListener("click", () => this.logout());

    // Theme toggle buttons
    const loginThemeBtn = document.getElementById("login-theme-toggle");
    if (loginThemeBtn) loginThemeBtn.addEventListener("click", () => Theme.toggle());

    const topbarThemeBtn = document.getElementById("topbar-theme-toggle");
    if (topbarThemeBtn) topbarThemeBtn.addEventListener("click", () => Theme.toggle());

    // 1-Click Interactive Demo Accounts Selector
    document.querySelectorAll(".demo-chip-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const u = btn.dataset.username;
        const p = btn.dataset.password;
        const userInp = document.getElementById("login-username");
        const passInp = document.getElementById("login-password");
        if (userInp) userInp.value = u;
        if (passInp) passInp.value = p;
        const submitBtn = document.getElementById("login-form").querySelector("button[type=submit]");
        if (submitBtn) submitBtn.focus();
      });
    });

    // Navigation and Shell listeners
    document.getElementById("nav-toggle").addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("collapsed");
    });
    document.getElementById("notif-btn").addEventListener("click", () => this.toggleNotifPanel());
    document.getElementById("global-search").addEventListener("input", debounce((e) => this.onSearch(e.target.value), 300));

    // Global keyboard shortcut: Ctrl+K or Cmd+K to search
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const searchInput = document.getElementById("global-search");
        if (searchInput) searchInput.focus();
      }
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest("#notif-btn") && !e.target.closest("#notif-panel")) {
        document.getElementById("notif-panel").hidden = true;
      }
      if (!e.target.closest("#global-search") && !e.target.closest("#search-results")) {
        document.getElementById("search-results").hidden = true;
      }
    });
    window.addEventListener("hashchange", () => this.route());

    if (Auth.accessToken && Auth.user) {
      this.showApp();
    } else {
      this.showLogin();
    }
  },

  showLogin(message) {
    if (this.pollHandle) clearInterval(this.pollHandle);
    document.getElementById("login-screen").hidden = false;
    document.getElementById("app-shell").hidden = true;
    document.getElementById("login-form").hidden = false;
    document.getElementById("mfa-form").hidden = true;
    document.getElementById("login-error").hidden = true;
    if (message) {
      const el = document.getElementById("login-error");
      el.textContent = message; el.hidden = false;
    }
  },

  async onLoginSubmit(e) {
    e.preventDefault();
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;
    const errEl = document.getElementById("login-error");
    errEl.hidden = true;
    try {
      const result = await Api.post("/v1/auth/login", { username, password }, { skipAuthRedirect: true });
      if (result.mfaRequired) {
        this._loginTicket = result.loginTicket;
        document.getElementById("login-form").hidden = true;
        document.getElementById("mfa-form").hidden = false;
      } else {
        this.onLoginSuccess(result);
      }
    } catch (err) {
      errEl.textContent = apiErrorMessage(err);
      errEl.hidden = false;
    }
  },

  async onMfaSubmit(e) {
    e.preventDefault();
    const code = document.getElementById("mfa-code").value.trim();
    const errEl = document.getElementById("mfa-error");
    errEl.hidden = true;
    try {
      const result = await Api.post("/v1/auth/mfa/verify", { loginTicket: this._loginTicket, code }, { skipAuthRedirect: true });
      this.onLoginSuccess(result);
    } catch (err) {
      errEl.textContent = apiErrorMessage(err);
      errEl.hidden = false;
    }
  },

  onLoginSuccess(result) {
    Auth.accessToken = result.accessToken;
    Auth.refreshToken = result.refreshToken;
    Auth.user = result.user;
    this.showApp();
  },

  async logout() {
    try { await Api.post("/v1/auth/logout", {}); } catch (e) { /* ignore */ }
    Auth.clear();
    this.showLogin();
  },

  showApp() {
    document.getElementById("login-screen").hidden = true;
    document.getElementById("app-shell").hidden = false;
    const u = Auth.user;
    const displayName = u.name || u.username || "-";
    document.getElementById("user-name").textContent = displayName;
    document.getElementById("user-role").textContent = (u.roles || []).join(", ");
    const avatar = document.getElementById("user-avatar");
    if (avatar) avatar.textContent = displayName.charAt(0).toUpperCase();

    this.renderNav();
    this.route();
    this.refreshNotifications();
    this.pollHandle = setInterval(() => this.refreshNotifications(), 25000);
  },

  NAV: [
    { group: "Overview", items: [
      { label: "Dashboard", route: "dashboard" },
    ]},
    { group: "Users & Roles", perm: ["MANAGE_USERS", "MANAGE_ROLES"], items: [
      { label: "Users", route: "users", perm: ["MANAGE_USERS"] },
      { label: "Roles & Permissions", route: "roles", perm: ["MANAGE_ROLES"] },
    ]},
    { group: "Production", perm: ["CREATE_ORDERS", "VIEW_ORDERS", "ALLOCATE_RESOURCES", "EXECUTE_PRODUCTION", "VIEW_PRODUCTION"], items: [
      { label: "Orders", route: "orders" },
      { label: "Production Runs", route: "runs" },
      { label: "Scheduling", route: "scheduling", perm: ["ALLOCATE_RESOURCES"] },
      { label: "Planning", route: "planning", perm: ["MANAGE_PROCESSES", "VIEW_PROCESSES"] },
    ]},
    { group: "Resources", items: [
      { label: "Machines", route: "machines" },
      { label: "Operators", route: "operators" },
      { label: "Materials & Batches", route: "materials" },
      { label: "Suppliers", route: "suppliers" },
    ]},
    { group: "Quality", perm: ["INSPECT_BATCH", "VIEW_QUALITY", "CREATE_DEFECT", "REPORT_QUALITY_DEFECT", "CREATE_HOLD", "REQUEST_HOLD", "CREATE_NCR"], items: [
      { label: "Inspections", route: "inspections" },
      { label: "Defects", route: "defects" },
      { label: "Quality Holds", route: "holds" },
      { label: "NCR / Corrective Action", route: "ncr" },
    ]},
    { group: "Monitoring", items: [
      { label: "Live Production", route: "live" },
      { label: "Alerts", route: "alerts" },
      { label: "Risks", route: "risks", perm: ["VIEW_RISK"] },
      { label: "Incidents", route: "incidents", perm: ["MANAGE_INCIDENTS", "REPORT_INCIDENTS"] },
      { label: "Overrides", route: "overrides", perm: ["CREATE_OVERRIDE", "APPROVE_OVERRIDE"] },
    ]},
    { group: "Traceability", perm: ["VIEW_TRACEABILITY_ALL", "VIEW_TRACEABILITY_LIMITED"], items: [
      { label: "Explorer", route: "traceability" },
    ]},
    { group: "Maintenance", perm: ["MANAGE_MAINTENANCE", "VIEW_MAINTENANCE", "REPORT_MAINTENANCE", "MANAGE_MACHINES"], items: [
      { label: "Maintenance Records", route: "maintenance" },
    ]},
    { group: "Reports", perm: ["VIEW_REPORTS"], items: [
      { label: "Reports", route: "reports" },
    ]},
    { group: "Governance", items: [
      { label: "Audit Logs", route: "audit-logs" },
      { label: "System Configuration", route: "settings", perm: ["MANAGE_SYSTEM_SETTINGS"] },
    ]},
  ],

  renderNav() {
    const sidebar = document.getElementById("sidebar");
    let html = "";
    for (const group of this.NAV) {
      if (group.perm && !Auth.hasPerm(...group.perm)) continue;
      const items = group.items.filter((it) => !it.perm || Auth.hasPerm(...it.perm));
      if (items.length === 0) continue;
      html += `<div class="sidebar-group"><div class="sidebar-group-title">${esc(group.group)}</div>`;
      for (const item of items) {
        const icon = NAV_ICONS[item.route] || "";
        html += `<a class="sidebar-link" data-route="${item.route}" href="#/${item.route}">${icon}<span>${esc(item.label)}</span></a>`;
      }
      html += `</div>`;
    }
    sidebar.innerHTML = html;
    sidebar.querySelectorAll(".sidebar-link").forEach((a) => {
      a.addEventListener("click", () => {
        sidebar.querySelectorAll(".sidebar-link").forEach((x) => x.classList.remove("active"));
        a.classList.add("active");
      });
    });
  },

  ROUTES: {
    "dashboard": () => (Views.dashboard ? Views.dashboard.render() : App.renderDashboard()),
    "users": () => Views.admin.users(),
    "roles": () => Views.admin.roles(),
    "orders": () => Views.production.orders(),
    "runs": () => Views.production.runs(),
    "scheduling": () => Views.production.scheduling(),
    "planning": () => Views.production.planning(),
    "machines": () => Views.resources.machines(),
    "operators": () => Views.resources.operators(),
    "materials": () => Views.resources.materials(),
    "suppliers": () => Views.resources.suppliers(),
    "inspections": () => Views.quality.inspections(),
    "defects": () => Views.quality.defects(),
    "holds": () => Views.quality.holds(),
    "ncr": () => Views.quality.ncr(),
    "live": () => Views.monitoring.live(),
    "alerts": () => Views.monitoring.alerts(),
    "risks": () => Views.monitoring.risks(),
    "incidents": () => Views.monitoring.incidents(),
    "overrides": () => Views.monitoring.overrides(),
    "traceability": () => (Views.traceability ? Views.traceability.traceability() : Views.monitoring.traceability()),
    "maintenance": () => Views.resources.maintenance(),
    "reports": () => Views.admin.reports(),
    "audit-logs": () => Views.admin.auditLogs(),
    "settings": () => Views.admin.settings(),
  },

  route() {
    const hash = window.location.hash.replace(/^#\//, "") || "dashboard";
    const [base] = hash.split("?");
    document.querySelectorAll(".sidebar-link").forEach((a) => a.classList.toggle("active", a.dataset.route === base));
    const handler = this.ROUTES[base];
    const content = document.getElementById("content");
    if (!handler) {
      content.innerHTML = `<div class="empty-state">Page not found.</div>`;
      return;
    }
    content.innerHTML = `<div class="empty-state">Loading view...</div>`;
    Promise.resolve(handler()).catch((err) => {
      console.error(err);
      content.innerHTML = `<div class="empty-state">Failed to load: ${esc(apiErrorMessage(err))}</div>`;
    });
  },

  navigate(route) {
    window.location.hash = "#/" + route;
  },

  async renderDashboard() {
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
    document.getElementById("refresh-dash").addEventListener("click", () => this.route());
  },

  statusBars(counts) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts).map(([k, v]) => `
      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px">
          <span>${statusBadge(k)}</span><span class="muted font-mono" style="font-weight:600">${v} (${Math.round((v / total) * 100)}%)</span>
        </div>
        <div class="risk-bar-track"><div class="risk-bar-fill" style="width:${(v / total) * 100}%;background:var(--primary)"></div></div>
      </div>`).join("") || `<p class="muted">No data.</p>`;
  },

  async refreshNotifications() {
    try {
      const d = await Api.get("/v1/notifications?unread_only=true");
      const count = document.getElementById("notif-count");
      count.hidden = d.items.length === 0;
      this._lastNotifs = d.items;
    } catch (e) { /* silent */ }
  },

  async toggleNotifPanel() {
    const panel = document.getElementById("notif-panel");
    if (!panel.hidden) { panel.hidden = true; return; }
    const d = await Api.get("/v1/notifications");
    panel.innerHTML = d.items.length
      ? d.items.map((n) => `<div class="notif-item ${n.readAt ? "" : "unread"}" data-id="${n.id}">
          <div class="notif-msg">${statusBadge(n.severity)} <span>${esc(n.message)}</span></div>
          <div class="notif-meta">${timeAgo(n.createdAt)}</div>
        </div>`).join("")
      : `<div class="notif-item muted" style="text-align:center;padding:24px;">No notifications.</div>`;
    panel.hidden = false;
    panel.querySelectorAll(".notif-item[data-id]").forEach((el) => {
      el.addEventListener("click", async () => {
        await Api.patch(`/v1/notifications/${el.dataset.id}`, {});
        this.refreshNotifications();
      });
    });
  },

  async onSearch(q) {
    const results = document.getElementById("search-results");
    if (!q || q.trim().length < 2) { results.hidden = true; return; }
    try {
      const d = await Api.get("/v1/search?q=" + encodeURIComponent(q));
      if (!d.results.length) {
        results.innerHTML = `<div class="search-item muted" style="text-align:center;padding:20px;">No matching records.</div>`;
        results.hidden = false;
        return;
      }
      results.innerHTML = d.results.map((r) => `
        <div class="search-item" data-type="${r.type}" data-id="${r.id}">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <strong style="color:var(--text)">${esc(r.label)}</strong>
            ${r.status ? statusBadge(r.status) : ""}
          </div>
          <div class="notif-meta">${esc(r.type || '')}</div>
        </div>`).join("");
      results.hidden = false;
      results.querySelectorAll(".search-item[data-id]").forEach((el) => {
        el.addEventListener("click", () => {
          results.hidden = true;
          document.getElementById("global-search").value = "";
          Views.monitoring.openTraceModal(el.dataset.type, el.dataset.id);
        });
      });
    } catch (e) { /* ignore search errors */ }
  },
};

window.Theme = Theme;
window.App = App;

document.addEventListener("DOMContentLoaded", () => App.init());
