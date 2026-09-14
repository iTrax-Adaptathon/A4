/**
 * API Client: Handles HTTP requests to the FastAPI backend, automatic Bearer
 * token injection, error extraction, and automatic re-authentication on 401.
 */
const API_BASE = ""; // same-origin backend

class ApiError extends Error {
  constructor(status, payload) {
    const msg = typeof payload === "object" && payload
      ? (payload.detail && payload.detail.message) || payload.detail || payload.message || JSON.stringify(payload)
      : String(payload);
    super(msg);
    this.status = status;
    this.payload = payload && payload.detail !== undefined ? payload.detail : payload;
  }
}

async function apiRequest(method, path, body, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (window.Auth && window.Auth.accessToken) {
    headers["Authorization"] = "Bearer " + window.Auth.accessToken;
  }
  if (opts.idempotencyKey) {
    headers["Idempotency-Key"] = opts.idempotencyKey;
  }

  let resp;
  try {
    resp = await fetch(API_BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new ApiError(0, { message: "Network error: could not reach the server." });
  }

  if (resp.status === 401 && !opts.skipAuthRedirect) {
    if (window.Auth) window.Auth.clear();
    if (window.App && window.App.showLogin) {
      window.App.showLogin("Your session has expired. Please sign in again.");
    }
    throw new ApiError(401, { message: "Session expired." });
  }

  let payload = null;
  const text = await resp.text();
  if (text) {
    try { payload = JSON.parse(text); } catch (e) { payload = text; }
  }

  if (!resp.ok) {
    throw new ApiError(resp.status, payload);
  }
  return payload;
}

const Api = {
  get: (path) => apiRequest("GET", path),
  post: (path, body, opts) => apiRequest("POST", path, body, opts),
  patch: (path, body) => apiRequest("PATCH", path, body),
  put: (path, body) => apiRequest("PUT", path, body),
  del: (path) => apiRequest("DELETE", path),
};

window.ApiError = ApiError;
window.apiRequest = apiRequest;
window.Api = Api;
