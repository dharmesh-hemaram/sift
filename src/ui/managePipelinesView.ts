// PLAN.md follow-up: a screen listing every saved sift across all
// endpoints (not just the currently selected response's), with rename and
// delete. Renaming reuses storage.ts's save() with the same steps and a new
// name — no separate storage method needed.
import { state } from "../state.ts";
import { pipelineStore } from "../persistence.ts";
import { selectResponse } from "../actions.ts";
import { scheduleRender } from "../renderBus.ts";
import type { PipelineRecord } from "../types.ts";

export async function renderManagePipelinesView(): Promise<HTMLElement> {
  const wrap = document.createElement("div");
  wrap.id = "manage-view";

  const header = document.createElement("div");
  header.id = "manage-header";
  header.textContent = "Manage saved sifts";
  wrap.appendChild(header);

  if (!pipelineStore) {
    wrap.appendChild(buildNote("Storage isn't available in this context."));
    return wrap;
  }

  const all = await pipelineStore.loadAll();
  const records = Object.values(all).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  if (records.length === 0) {
    wrap.appendChild(buildNote("No saved sifts yet — build one on a captured response and it'll show up here."));
    return wrap;
  }

  const table = document.createElement("table");
  table.id = "manage-table";
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Name</th><th>Endpoint</th><th>Steps</th><th>Updated</th><th></th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const record of records) tbody.appendChild(renderRow(record));
  table.appendChild(tbody);
  wrap.appendChild(table);

  return wrap;
}

function buildNote(text: string): HTMLElement {
  const note = document.createElement("div");
  note.id = "manage-empty";
  note.textContent = text;
  return note;
}

function renderRow(record: PipelineRecord): HTMLElement {
  const tr = document.createElement("tr");

  const nameTd = document.createElement("td");
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = record.name;
  nameInput.addEventListener("change", () => {
    void renamePipeline(record, nameInput.value.trim() || record.urlPattern);
  });
  nameTd.appendChild(nameInput);

  const patternTd = document.createElement("td");
  patternTd.className = "manage-pattern";
  patternTd.textContent = record.urlPattern;

  const stepsTd = document.createElement("td");
  stepsTd.textContent = String(record.steps.length);

  const updatedTd = document.createElement("td");
  updatedTd.textContent = new Date(record.updatedAt).toLocaleString();

  const actionsTd = document.createElement("td");
  actionsTd.className = "manage-actions";

  const matchingEntry = state.capturedResponses.find((r) => r.urlPattern === record.urlPattern);
  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.textContent = "Open";
  openBtn.disabled = !matchingEntry;
  openBtn.title = matchingEntry ? "" : "No captured response for this endpoint right now";
  openBtn.addEventListener("click", () => {
    if (matchingEntry) void selectResponse(matchingEntry);
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.textContent = "Delete";
  deleteBtn.className = "manage-delete";
  deleteBtn.addEventListener("click", () => {
    void deletePipeline(record.urlPattern);
  });

  actionsTd.append(openBtn, deleteBtn);
  tr.append(nameTd, patternTd, stepsTd, updatedTd, actionsTd);
  return tr;
}

async function renamePipeline(record: PipelineRecord, newName: string): Promise<void> {
  if (!pipelineStore) return;
  await pipelineStore.save(record.urlPattern, record.steps, newName);
  scheduleRender();
}

async function deletePipeline(urlPattern: string): Promise<void> {
  if (!pipelineStore) return;
  await pipelineStore.remove(urlPattern);
  scheduleRender();
}
