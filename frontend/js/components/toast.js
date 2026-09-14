/**
 * Toast Notifications Component: Handles non-blocking snackbar alerts.
 */
function toast(message, type = "info") {
  const root = document.getElementById("toast-root");
  if (!root) return;

  const div = document.createElement("div");
  div.className = `toast toast-${type}`;
  div.textContent = message;
  root.appendChild(div);

  setTimeout(() => {
    div.style.opacity = "0";
    div.style.transition = "opacity .3s";
    setTimeout(() => div.remove(), 300);
  }, 4200);
}

function notifyError(err) {
  toast(window.apiErrorMessage ? window.apiErrorMessage(err) : String(err), "error");
}

window.toast = toast;
window.notifyError = notifyError;
