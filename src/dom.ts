// The only module that calls document.getElementById — everything else
// imports these references instead of re-querying the DOM. Non-null
// asserted: these ids are fixed markup in panel.html, not conditional.
export const railList = document.getElementById("rail-list") as HTMLUListElement;
export const railCount = document.getElementById("rail-count") as HTMLSpanElement;
export const clearBtn = document.getElementById("clear-btn") as HTMLButtonElement;
export const combineToggleBtn = document.getElementById("combine-toggle-btn") as HTMLButtonElement;
export const manageToggleBtn = document.getElementById("manage-toggle-btn") as HTMLButtonElement;
export const main = document.getElementById("main") as HTMLElement;
