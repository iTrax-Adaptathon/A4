/**
 * Modal Dialog Component: Manages mounting, display, and teardown of dialogs.
 */
function closeModal() {
  const root = document.getElementById("modal-root");
  if (root) root.innerHTML = "";
}

function openModal({ title, bodyHtml, wide, footerHtml, onMount }) {
  const root = document.getElementById("modal-root");
  if (!root) return;

  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box ${wide ? "wide" : ""}">
        <div class="modal-header">
          <h3>${esc(title)}</h3>
          <button class="icon-btn" id="modal-close" title="Close">&times;</button>
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

  if (onMount) onMount(root);
}

window.closeModal = closeModal;
window.openModal = openModal;
