/**
 * Toast Notifications Component: Handles non-blocking snackbar alerts.
 */
function toast(message, type = "info") {
  const root = document.getElementById("toast-root");
  if (!root) return;

  const div = document.createElement("div");
  div.className = `toast toast-${type}`;

  const iconMap = {
    success: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    error: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
    info: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
  };

  div.innerHTML = `
    <span style="display:inline-flex;align-items:center;flex-shrink:0;">${iconMap[type] || iconMap.info}</span>
    <span style="flex:1;word-break:break-word;">${esc(message)}</span>
  `;
  root.appendChild(div);

  setTimeout(() => {
    div.style.opacity = "0";
    div.style.transform = "translateY(10px) scale(0.95)";
    div.style.transition = "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)";
    setTimeout(() => div.remove(), 260);
  }, 4200);
}

function notifyError(err) {
  toast(window.apiErrorMessage ? window.apiErrorMessage(err) : String(err), "error");
}

window.toast = toast;
window.notifyError = notifyError;
