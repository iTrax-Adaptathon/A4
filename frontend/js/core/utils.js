/**
 * Core Utility Functions: Formatting, escaping, dates, and helpers.
 */
function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtNum(n, digits = 2) {
  if (n === null || n === undefined || n === "") return "-";
  const num = Number(n);
  if (isNaN(num)) return n;
  return num.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function timeAgo(iso) {
  if (!iso) return "-";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function formToObject(form) {
  const data = {};
  new FormData(form).forEach((value, key) => {
    if (data[key] !== undefined) {
      if (!Array.isArray(data[key])) data[key] = [data[key]];
      data[key].push(value);
    } else {
      data[key] = value;
    }
  });
  return data;
}

function optionList(items, valueKey, labelFn) {
  return items.map((i) => `<option value="${esc(i[valueKey])}">${esc(labelFn(i))}</option>`).join("");
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function apiErrorMessage(err) {
  if (window.ApiError && err instanceof window.ApiError) {
    const p = err.payload;
    if (typeof p === "string") return p;
    if (p && p.message) {
      let msg = p.message;
      if (p.details && p.details.length) msg += " (" + JSON.stringify(p.details[0]) + ")";
      return msg;
    }
    return err.message;
  }
  return err ? (err.message || String(err)) : "Unknown error";
}

// Expose globals for convenience
window.esc = esc;
window.fmtDate = fmtDate;
window.fmtNum = fmtNum;
window.timeAgo = timeAgo;
window.formToObject = formToObject;
window.optionList = optionList;
window.debounce = debounce;
window.apiErrorMessage = apiErrorMessage;
