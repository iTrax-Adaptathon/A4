/**
 * Modal Dialog Component: Manages mounting, display, keyboard control, and teardown of dialogs.
 */
let _modalKeydownHandler = null;

function closeModal() {
  const root = document.getElementById("modal-root");
  if (root) root.innerHTML = "";
  if (_modalKeydownHandler) {
    document.removeEventListener("keydown", _modalKeydownHandler);
    _modalKeydownHandler = null;
  }
}

function openModal({ title, bodyHtml, wide, footerHtml, onMount }) {
  const root = document.getElementById("modal-root");
  if (!root) return;

  if (_modalKeydownHandler) {
    document.removeEventListener("keydown", _modalKeydownHandler);
  }

  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <h3 id="modal-title">${esc(title)}</h3>
          <button class="icon-btn" id="modal-close" title="Close dialog" aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ""}
      </div>
    </div>`;

  const closeBtn = document.getElementById("modal-close");
  if (closeBtn) closeBtn.onclick = closeModal;

  const overlay = document.getElementById("modal-overlay");
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target.id === "modal-overlay") closeModal();
    });
  }

  _modalKeydownHandler = (e) => {
    if (e.key === "Escape") closeModal();
  };
  document.addEventListener("keydown", _modalKeydownHandler);

  if (onMount) onMount(root);
}

window.closeModal = closeModal;
window.openModal = openModal;
