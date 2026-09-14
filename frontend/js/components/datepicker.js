/**
 * PCTS Modern Date & DateTime Picker Component
 * Replaces default browser datepicker popup with a sleek, themed dropdown.
 */

(function () {
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let dropdownEl = null;
  let currentInput = null;
  let currentType = "datetime-local"; // "date" or "datetime-local"

  // Active view & selection state
  let viewYear = 2026;
  let viewMonth = 8; // 0-indexed (8 = September)
  let selectedYear = null;
  let selectedMonth = null;
  let selectedDate = null;
  let selectedHour = 9; // 1-12
  let selectedMinute = 0; // 0-59
  let selectedAmPm = "AM"; // "AM" or "PM"
  let isMonthOverlayOpen = false;

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  /**
   * Builds the single floating dropdown DOM container.
   */
  function createDropdownDOM() {
    if (dropdownEl) return dropdownEl;

    dropdownEl = document.createElement("div");
    dropdownEl.id = "pcts-datepicker-dropdown";
    dropdownEl.className = "pcts-datepicker-dropdown";
    dropdownEl.innerHTML = `
      <div class="pcts-dp-body">
        <div class="pcts-dp-calendar-pane">
          <div class="pcts-dp-header">
            <button type="button" class="pcts-dp-month-label" id="pcts-dp-month-toggle">
              <span id="pcts-dp-month-text">September 2026</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <div class="pcts-dp-nav-btns">
              <button type="button" class="pcts-dp-nav-btn" id="pcts-dp-prev-month" title="Previous Month" aria-label="Previous Month">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
              </button>
              <button type="button" class="pcts-dp-nav-btn" id="pcts-dp-next-month" title="Next Month" aria-label="Next Month">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            </div>
          </div>
          <div class="pcts-dp-weekdays">
            <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
          </div>
          <div class="pcts-dp-days" id="pcts-dp-days-grid"></div>
          <div class="pcts-dp-overlay" id="pcts-dp-months-overlay" style="display:none;"></div>
        </div>

        <div class="pcts-dp-time-pane" id="pcts-dp-time-pane">
          <div class="pcts-dp-time-header">
            <span class="pcts-dp-time-title">Time</span>
            <span class="pcts-dp-time-badge" id="pcts-dp-time-badge">09:00 AM</span>
          </div>
          <div class="pcts-dp-time-cols">
            <div class="pcts-dp-time-col" id="pcts-dp-col-hours">
              <div class="pcts-dp-time-col-label">Hour</div>
            </div>
            <div class="pcts-dp-time-col" id="pcts-dp-col-minutes">
              <div class="pcts-dp-time-col-label">Min</div>
            </div>
            <div class="pcts-dp-time-col" id="pcts-dp-col-ampm">
              <div class="pcts-dp-time-col-label">Period</div>
              <button type="button" class="pcts-dp-time-item" data-ampm="AM">AM</button>
              <button type="button" class="pcts-dp-time-item" data-ampm="PM">PM</button>
            </div>
          </div>
        </div>
      </div>

      <div class="pcts-dp-footer">
        <div class="pcts-dp-footer-left">
          <button type="button" class="pcts-dp-btn-link" id="pcts-dp-clear-btn">Clear</button>
          <button type="button" class="pcts-dp-btn-link pcts-dp-btn-now" id="pcts-dp-today-btn">Now</button>
        </div>
        <button type="button" class="pcts-dp-btn-apply" id="pcts-dp-apply-btn">Apply</button>
      </div>
    `;

    document.body.appendChild(dropdownEl);

    // Populate Hour column (01..12)
    const hoursCol = dropdownEl.querySelector("#pcts-dp-col-hours");
    for (let h = 1; h <= 12; h++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pcts-dp-time-item";
      btn.dataset.hour = String(h);
      btn.textContent = pad(h);
      hoursCol.appendChild(btn);
    }

    // Populate Minute column (all 00..59 minutes, scrollable)
    const minsCol = dropdownEl.querySelector("#pcts-dp-col-minutes");
    for (let m = 0; m < 60; m++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pcts-dp-time-item";
      btn.dataset.minute = String(m);
      btn.textContent = pad(m);
      minsCol.appendChild(btn);
    }

    // Bind navigation buttons
    dropdownEl.querySelector("#pcts-dp-prev-month").onclick = (e) => {
      e.stopPropagation();
      viewMonth--;
      if (viewMonth < 0) {
        viewMonth = 11;
        viewYear--;
      }
      renderCalendar();
    };

    dropdownEl.querySelector("#pcts-dp-next-month").onclick = (e) => {
      e.stopPropagation();
      viewMonth++;
      if (viewMonth > 11) {
        viewMonth = 0;
        viewYear++;
      }
      renderCalendar();
    };

    // Month overlay toggle
    dropdownEl.querySelector("#pcts-dp-month-toggle").onclick = (e) => {
      e.stopPropagation();
      toggleMonthOverlay();
    };

    // Hour selection
    hoursCol.onclick = (e) => {
      const btn = e.target.closest("[data-hour]");
      if (!btn) return;
      e.stopPropagation();
      selectedHour = parseInt(btn.dataset.hour, 10);
      updateTimeHighlights();
      syncInputPreview();
    };

    // Minute selection
    minsCol.onclick = (e) => {
      const btn = e.target.closest("[data-minute]");
      if (!btn) return;
      e.stopPropagation();
      selectedMinute = parseInt(btn.dataset.minute, 10);
      updateTimeHighlights();
      syncInputPreview();
    };

    // AM/PM selection
    dropdownEl.querySelector("#pcts-dp-col-ampm").onclick = (e) => {
      const btn = e.target.closest("[data-ampm]");
      if (!btn) return;
      e.stopPropagation();
      selectedAmPm = btn.dataset.ampm;
      updateTimeHighlights();
      syncInputPreview();
    };

    // Action buttons
    dropdownEl.querySelector("#pcts-dp-clear-btn").onclick = (e) => {
      e.stopPropagation();
      if (currentInput) {
        currentInput.value = "";
        triggerEvents(currentInput);
      }
      close();
    };

    dropdownEl.querySelector("#pcts-dp-today-btn").onclick = (e) => {
      e.stopPropagation();
      const now = new Date();
      selectedYear = now.getFullYear();
      selectedMonth = now.getMonth();
      selectedDate = now.getDate();
      viewYear = selectedYear;
      viewMonth = selectedMonth;

      const rawH = now.getHours();
      selectedAmPm = rawH >= 12 ? "PM" : "AM";
      selectedHour = rawH % 12 || 12;
      selectedMinute = now.getMinutes();

      commitValue();
      close();
    };

    dropdownEl.querySelector("#pcts-dp-apply-btn").onclick = (e) => {
      e.stopPropagation();
      commitValue();
      close();
    };

    // Stop propagation inside dropdown clicks
    dropdownEl.addEventListener("mousedown", (e) => e.stopPropagation());
    dropdownEl.addEventListener("click", (e) => e.stopPropagation());

    return dropdownEl;
  }

  function toggleMonthOverlay() {
    const overlay = dropdownEl.querySelector("#pcts-dp-months-overlay");
    isMonthOverlayOpen = !isMonthOverlayOpen;
    if (!isMonthOverlayOpen) {
      overlay.style.display = "none";
      return;
    }
    overlay.innerHTML = MONTH_SHORT.map((m, i) => `
      <div class="pcts-dp-overlay-item ${i === viewMonth ? 'active' : ''}" data-overlay-month="${i}">${m}</div>
    `).join("");
    overlay.style.display = "grid";
    overlay.onclick = (e) => {
      const item = e.target.closest("[data-overlay-month]");
      if (!item) return;
      e.stopPropagation();
      viewMonth = parseInt(item.dataset.overlayMonth, 10);
      overlay.style.display = "none";
      isMonthOverlayOpen = false;
      renderCalendar();
    };
  }

  /**
   * Renders the 42-day calendar grid for viewYear and viewMonth.
   */
  function renderCalendar() {
    createDropdownDOM();
    const monthText = dropdownEl.querySelector("#pcts-dp-month-text");
    monthText.textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

    const grid = dropdownEl.querySelector("#pcts-dp-days-grid");
    grid.innerHTML = "";

    // Day calculations (Monday as 1st day of week)
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun, 1 = Mon ...
    const shift = (firstDayIndex + 6) % 7; // Monday = 0, Sunday = 6
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const today = new Date();
    const isThisMonth = today.getFullYear() === viewYear && today.getMonth() === viewMonth;

    // Previous month filler days
    for (let i = shift - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pcts-dp-day pcts-dp-other-month";
      btn.textContent = d;
      btn.onclick = (e) => {
        e.stopPropagation();
        viewMonth--;
        if (viewMonth < 0) {
          viewMonth = 11;
          viewYear--;
        }
        selectedYear = viewYear;
        selectedMonth = viewMonth;
        selectedDate = d;
        renderCalendar();
        syncInputPreview();
        if (currentType === "date") {
          commitValue();
          close();
        }
      };
      grid.appendChild(btn);
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pcts-dp-day";
      btn.textContent = d;

      if (isThisMonth && today.getDate() === d) {
        btn.classList.add("pcts-dp-today");
      }

      if (selectedYear === viewYear && selectedMonth === viewMonth && selectedDate === d) {
        btn.classList.add("pcts-dp-selected");
      }

      btn.onclick = (e) => {
        e.stopPropagation();
        selectedYear = viewYear;
        selectedMonth = viewMonth;
        selectedDate = d;
        renderCalendar();
        syncInputPreview();
        if (currentType === "date") {
          commitValue();
          close();
        }
      };
      grid.appendChild(btn);
    }

    // Next month filler days (fill up to 42 cells)
    const totalRendered = shift + daysInMonth;
    const remaining = 42 - totalRendered;
    for (let d = 1; d <= remaining; d++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pcts-dp-day pcts-dp-other-month";
      btn.textContent = d;
      btn.onclick = (e) => {
        e.stopPropagation();
        viewMonth++;
        if (viewMonth > 11) {
          viewMonth = 0;
          viewYear++;
        }
        selectedYear = viewYear;
        selectedMonth = viewMonth;
        selectedDate = d;
        renderCalendar();
        syncInputPreview();
        if (currentType === "date") {
          commitValue();
          close();
        }
      };
      grid.appendChild(btn);
    }
  }

  function updateTimeHighlights() {
    createDropdownDOM();
    const timePane = dropdownEl.querySelector("#pcts-dp-time-pane");
    if (currentType === "date") {
      timePane.style.display = "none";
      dropdownEl.querySelector("#pcts-dp-today-btn").textContent = "Today";
      return;
    } else {
      timePane.style.display = "flex";
      dropdownEl.querySelector("#pcts-dp-today-btn").textContent = "Now";
    }

    // Update time badge
    const badge = dropdownEl.querySelector("#pcts-dp-time-badge");
    badge.textContent = `${pad(selectedHour)}:${pad(selectedMinute)} ${selectedAmPm}`;

    // Highlight Hour
    dropdownEl.querySelectorAll("#pcts-dp-col-hours [data-hour]").forEach((btn) => {
      const isSel = parseInt(btn.dataset.hour, 10) === selectedHour;
      btn.classList.toggle("pcts-dp-time-selected", isSel);
      if (isSel && dropdownEl.style.display === "block") {
        btn.scrollIntoView({ block: "nearest", behavior: "instant" });
      }
    });

    // Highlight Minute
    dropdownEl.querySelectorAll("#pcts-dp-col-minutes [data-minute]").forEach((btn) => {
      const isSel = parseInt(btn.dataset.minute, 10) === selectedMinute;
      btn.classList.toggle("pcts-dp-time-selected", isSel);
      if (isSel && dropdownEl.style.display === "block") {
        btn.scrollIntoView({ block: "nearest", behavior: "instant" });
      }
    });

    // Highlight AM/PM
    dropdownEl.querySelectorAll("#pcts-dp-col-ampm [data-ampm]").forEach((btn) => {
      btn.classList.toggle("pcts-dp-time-selected", btn.dataset.ampm === selectedAmPm);
    });
  }

  /**
   * Generates formatted value string for current state.
   */
  function formatCurrentValue() {
    if (!selectedYear || selectedDate === null) return "";
    const yyyy = selectedYear;
    const mm = pad(selectedMonth + 1);
    const dd = pad(selectedDate);

    if (currentType === "date") {
      return `${yyyy}-${mm}-${dd}`;
    }

    // 24-hour calculation for standard ISO/HTML5 compatibility
    let h24 = selectedHour % 12;
    if (selectedAmPm === "PM") h24 += 12;

    return `${yyyy}-${mm}-${dd}T${pad(h24)}:${pad(selectedMinute)}`;
  }

  function syncInputPreview() {
    if (!currentInput) return;
    const val = formatCurrentValue();
    if (val) {
      currentInput.value = val;
    }
  }

  function commitValue() {
    if (!currentInput) return;
    if (!selectedYear || selectedDate === null) {
      const now = new Date();
      selectedYear = now.getFullYear();
      selectedMonth = now.getMonth();
      selectedDate = now.getDate();
    }
    const val = formatCurrentValue();
    currentInput.value = val;
    triggerEvents(currentInput);
  }

  function triggerEvents(input) {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /**
   * Parses the input's current value or sets default state.
   */
  function parseInputValue(input) {
    const raw = (input.value || "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);

    if (match) {
      selectedYear = parseInt(match[1], 10);
      selectedMonth = parseInt(match[2], 10) - 1;
      selectedDate = parseInt(match[3], 10);
      viewYear = selectedYear;
      viewMonth = selectedMonth;

      const rawH = match[4] ? parseInt(match[4], 10) : 9;
      selectedAmPm = rawH >= 12 ? "PM" : "AM";
      selectedHour = rawH % 12 || 12;
      selectedMinute = match[5] ? parseInt(match[5], 10) : 0;
      if (selectedMinute >= 60) selectedMinute = 0;
    } else {
      const d = new Date();
      selectedYear = d.getFullYear();
      selectedMonth = d.getMonth();
      selectedDate = d.getDate();
      viewYear = selectedYear;
      viewMonth = selectedMonth;

      const rawH = d.getHours();
      selectedAmPm = rawH >= 12 ? "PM" : "AM";
      selectedHour = rawH % 12 || 12;
      selectedMinute = d.getMinutes();
    }
  }

  /**
   * Positions the floating dropdown anchored to the input.
   */
  function positionDropdown(input) {
    createDropdownDOM();
    const rect = input.getBoundingClientRect();
    const dpWidth = currentType === "date" ? 290 : 495;
    const dpHeight = 350;

    let left = rect.left;
    // Prevent overflow on right edge of viewport
    if (left + dpWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - dpWidth - 12);
    }

    let top = rect.bottom + 6;
    // If not enough room below, open above the input
    if (top + dpHeight > window.innerHeight - 12 && rect.top > dpHeight + 12) {
      top = rect.top - dpHeight - 6;
    }

    dropdownEl.style.left = `${Math.round(left)}px`;
    dropdownEl.style.top = `${Math.round(top)}px`;
  }

  function open(input) {
    if (currentInput === input && dropdownEl && dropdownEl.style.display === "block") {
      return;
    }

    currentInput = input;
    currentType = input.dataset.pickerType || "datetime-local";

    createDropdownDOM();
    parseInputValue(input);
    renderCalendar();
    updateTimeHighlights();
    positionDropdown(input);

    dropdownEl.style.display = "block";
    isMonthOverlayOpen = false;
    dropdownEl.querySelector("#pcts-dp-months-overlay").style.display = "none";
  }

  function close() {
    if (dropdownEl) {
      dropdownEl.style.display = "none";
      isMonthOverlayOpen = false;
    }
    if (currentInput) {
      triggerEvents(currentInput);
    }
    currentInput = null;
  }

  /**
   * Attaches custom datepicker behavior to a target input.
   */
  function attach(input) {
    if (input.dataset.pctsDpAttached === "true") return;
    input.dataset.pctsDpAttached = "true";

    // Determine type: datetime-local or date
    const origType = input.getAttribute("type") || "text";
    const pickerType = origType.toLowerCase() === "date" ? "date" : "datetime-local";
    input.dataset.pickerType = pickerType;

    // Convert to type="text" to prevent browser native OS popup
    input.setAttribute("type", "text");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("placeholder", pickerType === "date" ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm");
    input.classList.add("pcts-datepicker-input");

    // Wrap in relative container if not already wrapped
    let wrapper = input.parentElement;
    if (!wrapper || !wrapper.classList.contains("pcts-datepicker-wrapper")) {
      wrapper = document.createElement("div");
      wrapper.className = "pcts-datepicker-wrapper";
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
    }

    // Add calendar icon trigger button
    let toggleBtn = wrapper.querySelector(".pcts-datepicker-toggle-btn");
    if (!toggleBtn) {
      toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "pcts-datepicker-toggle-btn";
      toggleBtn.tabIndex = -1;
      toggleBtn.title = "Open calendar";
      toggleBtn.setAttribute("aria-label", "Open calendar");
      toggleBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      `;
      wrapper.appendChild(toggleBtn);
    }

    // Event listeners
    input.addEventListener("click", (e) => {
      e.stopPropagation();
      open(input);
    });

    input.addEventListener("focus", () => {
      open(input);
    });

    input.addEventListener("input", () => {
      if (dropdownEl && dropdownEl.style.display === "block") {
        parseInputValue(input);
        renderCalendar();
        updateTimeHighlights();
      }
    });

    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (currentInput === input && dropdownEl && dropdownEl.style.display === "block") {
        close();
      } else {
        open(input);
        input.focus();
      }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        close();
      } else if (e.key === "Enter") {
        commitValue();
        close();
      }
    });
  }

  /**
   * Scans a container for date inputs and attaches the custom picker.
   */
  function scan(root = document.body) {
    if (!root || !root.querySelectorAll) return;
    const selectors = [
      'input[type="date"]',
      'input[type="datetime-local"]',
      'input[data-datepicker]'
    ];
    root.querySelectorAll(selectors.join(",")).forEach((input) => {
      attach(input);
    });
  }

  // Global outside click and escape listeners
  document.addEventListener("mousedown", (e) => {
    if (!dropdownEl || dropdownEl.style.display !== "block") return;
    if (dropdownEl.contains(e.target)) return;
    if (currentInput && (currentInput === e.target || currentInput.parentElement?.contains(e.target))) return;
    close();
  });

  window.addEventListener("resize", () => {
    if (currentInput && dropdownEl && dropdownEl.style.display === "block") {
      positionDropdown(currentInput);
    }
  });

  window.addEventListener("scroll", () => {
    if (currentInput && dropdownEl && dropdownEl.style.display === "block") {
      positionDropdown(currentInput);
    }
  }, true);

  // MutationObserver to automatically attach to dynamically rendered inputs (modals, views, routes)
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          scan(node);
        }
      }
    }
  });

  // Initialize once DOM is ready
  function init() {
    createDropdownDOM();
    scan(document.body);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Public API
  window.PCTSDatePicker = {
    attach,
    scan,
    open,
    close,
  };
})();
