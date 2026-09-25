import { state } from "../state.ts";
import { railList, railCount, clearBtn, settingsBtn, settingsMenu, manageToggleBtn } from "../dom.ts";
import { selectResponse, clearAll, toggleManageMode } from "../actions.ts";
import { formatBytes, urlSlug } from "../lib/format.ts";

function closeSettingsMenu(): void {
  settingsMenu.hidden = true;
  settingsBtn.setAttribute("aria-expanded", "false");
}

// Static listeners on the rail's own controls — called once at startup.
export function initRail(): void {
  clearBtn.addEventListener("click", clearAll);
  settingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = settingsMenu.hidden;
    settingsMenu.hidden = !willOpen;
    settingsBtn.setAttribute("aria-expanded", String(willOpen));
  });
  document.addEventListener("click", closeSettingsMenu);
  manageToggleBtn.addEventListener("click", () => {
    toggleManageMode();
    closeSettingsMenu();
  });
}

// Rebuilds the captured-response list. Same idea as DevTools' Network tab:
// last path segment, status, size, all on one line; full URL on hover.
export function renderRail(): void {
  railCount.textContent = String(state.capturedResponses.length);
  settingsBtn.classList.toggle("active", state.viewMode === "manage");
  manageToggleBtn.classList.toggle("active", state.viewMode === "manage");
  railList.innerHTML = "";

  for (const entry of state.capturedResponses) {
    const li = document.createElement("li");
    li.className = "rail-item";
    if (entry.id === state.selectedId) li.classList.add("selected");
    li.title = entry.url;
    li.addEventListener("click", () => {
      void selectResponse(entry);
    });

    const nameEl = document.createElement("span");
    nameEl.className = "rail-item-name";
    nameEl.textContent = urlSlug(entry.url);

    const statusEl = document.createElement("span");
    statusEl.className = "rail-item-status " + (entry.status < 400 ? "status-ok" : "status-error");
    statusEl.textContent = String(entry.status);

    const sizeEl = document.createElement("span");
    sizeEl.className = "rail-item-size";
    sizeEl.textContent = formatBytes(entry.size);

    li.append(nameEl, statusEl, sizeEl);
    railList.appendChild(li);
  }
}
