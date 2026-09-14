/**
 * Auth Service: Manages authentication tokens, current user profile,
 * and RBAC permission checks.
 */
const Auth = {
  get accessToken() { return localStorage.getItem("pcts_access_token"); },
  set accessToken(v) { v ? localStorage.setItem("pcts_access_token", v) : localStorage.removeItem("pcts_access_token"); },

  get refreshToken() { return localStorage.getItem("pcts_refresh_token"); },
  set refreshToken(v) { v ? localStorage.setItem("pcts_refresh_token", v) : localStorage.removeItem("pcts_refresh_token"); },

  get user() {
    try { return JSON.parse(localStorage.getItem("pcts_user") || "null"); } catch (e) { return null; }
  },
  set user(v) { v ? localStorage.setItem("pcts_user", JSON.stringify(v)) : localStorage.removeItem("pcts_user"); },

  clear() {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
  },

  hasPerm(...codes) {
    const u = this.user;
    if (!u || !u.permissions) return false;
    return codes.some((c) => u.permissions.includes(c));
  },
};

window.Auth = Auth;
