// Phase 0: capture every JSON response DevTools sees.
// Phase 1: click a captured response to view raw formatted JSON.
// Phase 2/3: build a chainable pipeline (extract/filter/sort/... + custom
// expression escape hatch), view the result as Table or Raw.
// Phase 4: persist pipeline structure per urlPattern.
// Phase 5: export/import pipeline structure.
// Phase 6: multi-response combine — built with Dharmesh's explicit sign-off
// on the interim approach only (plain dropdown input picker, no visual
// connector diagram; ephemeral, not persisted — see PLAN.md Phase 6).
// See PLAN.md / SPEC.md.

import { normalizeUrlPattern } from "./lib/urlPattern.js";
import { OP_DEFINITIONS, OP_DEFINITIONS_BY_ID, runPipeline, detectKeys } from "./lib/pipeline.js";
import { FILTER_OPERATORS } from "./lib/ops.js";
import { createPipelineStore } from "./lib/storage.js";
import { buildExport, parseImport, validateImportedPipeline } from "./lib/exportImport.js";
import { formatBytes, escapeHtml, highlightJson, urlSlug } from "./lib/format.js";
import { COMBINE_OPERATIONS, COMBINE_OPERATIONS_BY_ID, runCombine, fieldNameFromUrlPattern } from "./lib/combine.js";

/** @type {Array<{id:number,url:string,urlPattern:string,status:number,size:number,time:string,content:string}>} */
const capturedResponses = [];
let nextId = 1;
let selectedId = null;
let pipelineSteps = [];
let resultViewMode = "table"; // 'table' | 'raw'
let includeSampleOnExport = false;
let importError = null;

let viewMode = "single"; // 'single' | 'combine'
let combineOperation = "concat";
/** @type {Array<{responseId: number|null, key: string}>} */
let combineInputs = [
  { responseId: null, key: "" },
  { responseId: null, key: "" },
];
let combineResultViewMode = "table";

const railList = document.getElementById("rail-list");
const railCount = document.getElementById("rail-count");
const clearBtn = document.getElementById("clear-btn");
const combineToggleBtn = document.getElementById("combine-toggle-btn");
const main = document.getElementById("main");

// chrome.devtools.network is only available when this page is hosted by a
// real, open DevTools window. When it's missing (e.g. panel.html opened
// directly, as Playwright e2e tests do — there is no way to script the
// actual DevTools UI itself, see test/e2e/README.md) we expose the same
// handler as a test hook instead of crashing, so the real capture/render
// code path still runs end to end in a real browser.
const networkSource = typeof chrome !== "undefined" ? chrome.devtools?.network : undefined;
const pipelineStore =
  typeof chrome !== "undefined" && chrome.storage?.local ? createPipelineStore(chrome.storage.local) : null;

// --- sandboxed custom-expression evaluation (see src/sandbox.js) ---
let sandboxFrame = null;
let sandboxReady = null;
let sandboxReqId = 0;
const sandboxPending = new Map();

function ensureSandbox() {
  if (sandboxFrame) return sandboxReady;
  sandboxFrame = document.createElement("iframe");
  sandboxFrame.src = "sandbox.html";
  sandboxFrame.style.display = "none";
  sandboxReady = new Promise((resolve) => {
    sandboxFrame.addEventListener("load", () => resolve(), { once: true });
  });
  window.addEventListener("message", (event) => {
    if (event.source !== sandboxFrame.contentWindow) return;
    const { id, result, error } = event.data ?? {};
    const pending = sandboxPending.get(id);
    if (!pending) return;
    sandboxPending.delete(id);
    if (error) pending.reject(new Error(error));
    else pending.resolve(result);
  });
  document.body.appendChild(sandboxFrame);
  return sandboxReady;
}

async function runCustomExpressionInSandbox(data, code) {
  await ensureSandbox();
  const id = ++sandboxReqId;
  return new Promise((resolve, reject) => {
    sandboxPending.set(id, { resolve, reject });
    sandboxFrame.contentWindow.postMessage({ id, data, code }, "*");
  });
}

const pipelineHandlerOverrides = { custom: (data, step) => runCustomExpressionInSandbox(data, step.code ?? "") };

function selectedEntry() {
  return capturedResponses.find((r) => r.id === selectedId) ?? null;
}

function parsedData(entry) {
  if (!entry) return undefined;
  if (!("_parsed" in entry)) {
    try {
      entry._parsed = JSON.parse(entry.content);
    } catch {
      entry._parsed = undefined;
    }
  }
  return entry._parsed;
}

// ---------------------------------------------------------------- capture

function handleRequestFinished(request) {
  const mimeType = request.response?.content?.mimeType ?? "";
  const looksJson = mimeType.includes("json");

  request.getContent((content) => {
    if (!content) return;
    try {
      JSON.parse(content);
    } catch {
      if (looksJson) return; // Content-Type said JSON but body wasn't parseable.
      return; // Not JSON at all — ignored for v1 (SPEC.md §1).
    }

    capturedResponses.push({
      id: nextId++,
      url: request.request.url,
      urlPattern: normalizeUrlPattern(request.request.url),
      status: request.response.status,
      size: content.length,
      time: new Date().toISOString(),
      content,
    });

    render();
  });
}

if (networkSource) {
  networkSource.onRequestFinished.addListener(handleRequestFinished);
} else {
  window.__sift = { handleRequestFinished };
}

// ---------------------------------------------------------- selection/rail

async function selectResponse(entry) {
  persistPipeline.flush(); // don't lose an in-flight edit on the response we're leaving
  selectedId = entry.id;
  resultViewMode = "table";
  importError = null;
  viewMode = "single";
  pipelineSteps = (pipelineStore && (await pipelineStore.load(entry.urlPattern))?.steps) || [];
  render();
}

clearBtn.addEventListener("click", () => {
  capturedResponses.length = 0;
  selectedId = null;
  pipelineSteps = [];
  combineInputs = [
    { responseId: null, key: "" },
    { responseId: null, key: "" },
  ];
  render();
});

combineToggleBtn.addEventListener("click", () => {
  viewMode = viewMode === "combine" ? "single" : "combine";
  combineToggleBtn.classList.toggle("active", viewMode === "combine");
  render();
});

function render() {
  railCount.textContent = String(capturedResponses.length);
  railList.innerHTML = "";

  for (const entry of capturedResponses) {
    const li = document.createElement("li");
    li.className = "rail-item";
    if (entry.id === selectedId) li.classList.add("selected");
    li.addEventListener("click", () => selectResponse(entry));

    li.title = entry.url; // full URL on hover — the row itself only shows the slug

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

  renderMain();
}

// ------------------------------------------------------------- pipeline IO

function debounce(fn, ms) {
  let timer = null;
  let pendingArgs = null;
  function wrapped(...args) {
    pendingArgs = args;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const args2 = pendingArgs;
      pendingArgs = null;
      fn(...args2);
    }, ms);
  }
  wrapped.flush = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    const args = pendingArgs;
    pendingArgs = null;
    fn(...args);
  };
  return wrapped;
}

const persistPipeline = debounce(async (urlPattern, steps) => {
  if (pipelineStore) await pipelineStore.save(urlPattern, steps);
}, 300);

function updatePipeline(mutate) {
  pipelineSteps = mutate(pipelineSteps);
  const entry = selectedEntry();
  if (entry) persistPipeline(entry.urlPattern, pipelineSteps);
  renderMain();
}

// ------------------------------------------------------------------ main

function buildEmptyState(text) {
  const empty = document.createElement("div");
  empty.id = "empty-state";
  empty.textContent = text;
  return empty;
}

// Custom-expression steps evaluate asynchronously (sandboxed iframe — see
// runCustomExpressionInSandbox), so this whole function is async. Every
// DOM node is built off-tree first; `main` itself is only touched once, at
// the end, behind a token check — otherwise two renders triggered close
// together (e.g. two quick edits) could each clear `main` mid-await and
// interleave, leaving duplicated or stale nodes in the live DOM.
let renderToken = 0;

async function renderMain() {
  const token = ++renderToken;

  if (viewMode === "combine") {
    const view = renderCombineView();
    if (token !== renderToken) return;
    main.replaceChildren(view);
    return;
  }

  const entry = selectedEntry();

  if (!entry) {
    if (token !== renderToken) return;
    main.replaceChildren(
      buildEmptyState(
        capturedResponses.length
          ? "Select a captured response on the left to view it."
          : "Reload the inspected page — captured JSON responses will appear on the left.",
      ),
    );
    return;
  }

  const data = parsedData(entry);
  if (data === undefined) {
    if (token !== renderToken) return;
    main.replaceChildren(buildEmptyState("Couldn't parse this response as JSON."));
    return;
  }

  const header = document.createElement("div");
  header.id = "json-view-header";
  header.textContent = entry.url;
  header.title = entry.url;

  const pipelineBar = await renderPipelineBar(data);
  const { result, stepResults } = await runPipeline(data, pipelineSteps, pipelineHandlerOverrides);
  const validated = validateImportedPipeline({ steps: pipelineSteps, urlPattern: entry.urlPattern }, data);
  const brokenBanner = buildBrokenBanner(pipelineSteps, stepResults, validated.steps);
  const exportImportBar = renderExportImportBar(entry);
  const resultNode =
    pipelineSteps.length === 0
      ? renderRawView(data)
      : renderResultView(result, resultViewMode, (m) => {
          resultViewMode = m;
          renderMain();
        });

  if (token !== renderToken) return; // superseded by a newer render — discard

  const children = [header, pipelineBar];
  if (brokenBanner) children.push(brokenBanner);
  children.push(exportImportBar, resultNode);
  main.replaceChildren(...children);
}

function buildBrokenBanner(steps, stepResults, validatedSteps) {
  const messages = [];
  stepResults.forEach((sr, i) => {
    if (sr.broken) messages.push(`Step ${i + 1} (${OP_DEFINITIONS_BY_ID[steps[i]?.op]?.label ?? steps[i]?.op}): ${sr.error}`);
  });
  validatedSteps.forEach((s, i) => {
    if (s.broken && !stepResults[i]?.broken) {
      messages.push(`Step ${i + 1} (${OP_DEFINITIONS_BY_ID[s.op]?.label ?? s.op}): key not found in this response — ${s.missingKeys.join(", ")}`);
    }
  });
  if (!messages.length) return null;
  const banner = document.createElement("div");
  banner.id = "broken-banner";
  banner.innerHTML = messages.map((m) => `<div>${escapeHtml(m)}</div>`).join("");
  return banner;
}

// --------------------------------------------------------------- raw view

function renderRawView(data) {
  let pretty;
  try {
    pretty = JSON.stringify(data, null, 2);
  } catch {
    pretty = String(data);
  }
  const pre = document.createElement("pre");
  pre.id = "json-view";
  pre.innerHTML = highlightJson(escapeHtml(pretty));
  return pre;
}

// ------------------------------------------------------------ result view

// Generic Table/Raw result view — used by both the single-response pipeline
// and the combine view, each with their own mode state so switching tabs in
// one doesn't affect the other.
function renderResultView(result, mode, onModeChange) {
  const wrap = document.createElement("div");
  wrap.id = "result-view";

  const tabs = document.createElement("div");
  tabs.id = "result-tabs";
  for (const m of ["table", "raw"]) {
    const btn = document.createElement("button");
    btn.textContent = m === "table" ? "Table" : "Raw";
    btn.className = "result-tab" + (mode === m ? " active" : "");
    btn.addEventListener("click", () => onModeChange(m));
    tabs.appendChild(btn);
  }
  wrap.appendChild(tabs);

  const body = document.createElement("div");
  body.id = "result-body";
  body.appendChild(mode === "table" ? renderTable(result) : renderRawView(result));
  wrap.appendChild(body);

  return wrap;
}

function cellText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function renderTable(data) {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      const p = document.createElement("div");
      p.className = "table-empty";
      p.textContent = "Empty array.";
      return p;
    }
    const objectRows = data.every((row) => row !== null && typeof row === "object" && !Array.isArray(row));
    const table = document.createElement("table");
    table.className = "result-table";

    if (objectRows) {
      const headers = [...new Set(data.flatMap((row) => Object.keys(row)))];
      const thead = document.createElement("thead");
      thead.innerHTML = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      for (const row of data) {
        const tr = document.createElement("tr");
        tr.innerHTML = headers.map((h) => `<td>${escapeHtml(cellText(row[h]))}</td>`).join("");
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
    } else {
      table.innerHTML = `<thead><tr><th>value</th></tr></thead><tbody>${data
        .map((v) => `<tr><td>${escapeHtml(cellText(v))}</td></tr>`)
        .join("")}</tbody>`;
    }
    return table;
  }

  if (data !== null && typeof data === "object") {
    const table = document.createElement("table");
    table.className = "result-table";
    table.innerHTML = `<thead><tr><th>key</th><th>value</th></tr></thead><tbody>${Object.entries(data)
      .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(cellText(v))}</td></tr>`)
      .join("")}</tbody>`;
    return table;
  }

  const p = document.createElement("div");
  p.className = "table-empty";
  p.textContent = String(data);
  return p;
}

// ----------------------------------------------------------- pipeline bar

async function renderPipelineBar(originalData) {
  const bar = document.createElement("div");
  bar.id = "pipeline-bar";

  let running = originalData;
  for (let i = 0; i < pipelineSteps.length; i++) {
    const inputAtStep = running;
    const { result: afterStep } = await runPipeline(
      originalData,
      pipelineSteps.slice(0, i + 1),
      pipelineHandlerOverrides,
    );
    bar.appendChild(renderStepChip(pipelineSteps[i], i, inputAtStep));
    running = afterStep;
  }

  bar.appendChild(renderAddStep());
  return bar;
}

function renderAddStep() {
  const wrap = document.createElement("div");
  wrap.className = "add-step";

  const select = document.createElement("select");
  select.className = "add-step-select";
  const placeholder = document.createElement("option");
  placeholder.textContent = "+ Add step…";
  placeholder.value = "";
  select.appendChild(placeholder);

  for (const category of ["array", "object", "custom"]) {
    const group = document.createElement("optgroup");
    group.label = category === "array" ? "Array of objects" : category === "object" ? "Single object" : "Escape hatch";
    for (const def of OP_DEFINITIONS.filter((d) => d.category === category)) {
      const opt = document.createElement("option");
      opt.value = def.id;
      opt.textContent = def.label;
      group.appendChild(opt);
    }
    select.appendChild(group);
  }

  select.addEventListener("change", () => {
    const def = OP_DEFINITIONS_BY_ID[select.value];
    if (!def) return;
    const step = { op: def.id };
    for (const p of def.params) step[p.name] = p.default ?? (p.type === "keys" ? [] : p.type === "conditions" ? [] : "");
    updatePipeline((steps) => [...steps, step]);
  });

  wrap.appendChild(select);
  return wrap;
}

function renderStepChip(step, index, inputData) {
  const def = OP_DEFINITIONS_BY_ID[step.op];
  const chip = document.createElement("div");
  chip.className = "step-chip";

  const headerRow = document.createElement("div");
  headerRow.className = "step-chip-header";

  const label = document.createElement("span");
  label.className = "step-chip-label";
  label.textContent = def ? def.label : step.op;
  headerRow.appendChild(label);

  const upBtn = document.createElement("button");
  upBtn.textContent = "↑";
  upBtn.title = "Move earlier";
  upBtn.disabled = index === 0;
  upBtn.addEventListener("click", () =>
    updatePipeline((steps) => {
      const copy = [...steps];
      [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
      return copy;
    }),
  );

  const downBtn = document.createElement("button");
  downBtn.textContent = "↓";
  downBtn.title = "Move later";
  downBtn.disabled = index === pipelineSteps.length - 1;
  downBtn.addEventListener("click", () =>
    updatePipeline((steps) => {
      const copy = [...steps];
      [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
      return copy;
    }),
  );

  const removeBtn = document.createElement("button");
  removeBtn.textContent = "×";
  removeBtn.title = "Remove step";
  removeBtn.className = "step-chip-remove";
  removeBtn.addEventListener("click", () =>
    updatePipeline((steps) => steps.filter((_, i) => i !== index)),
  );

  headerRow.append(upBtn, downBtn, removeBtn);
  chip.appendChild(headerRow);

  if (def) {
    const paramsRow = document.createElement("div");
    paramsRow.className = "step-chip-params";
    for (const param of def.params) {
      paramsRow.appendChild(renderParamControl(step, index, param, inputData));
    }
    chip.appendChild(paramsRow);
  }

  return chip;
}

function onStepFieldChange(index, name, value) {
  updatePipeline((steps) => {
    const copy = steps.map((s) => ({ ...s }));
    copy[index][name] = value;
    return copy;
  });
}

function renderParamControl(step, index, param, inputData) {
  const wrap = document.createElement("label");
  wrap.className = "param-control";
  wrap.dataset.paramType = param.type;

  const labelText = document.createElement("span");
  labelText.className = "param-label";
  labelText.textContent = param.label;
  wrap.appendChild(labelText);

  const keys = detectKeys(inputData);
  const datalistId = `keys-${step.op}-${index}-${param.name}`;

  if (param.type === "keys") {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "field1, field2";
    input.value = (step[param.name] ?? []).join(", ");
    input.addEventListener("change", () =>
      onStepFieldChange(
        index,
        param.name,
        input.value.split(",").map((s) => s.trim()).filter(Boolean),
      ),
    );
    wrap.appendChild(input);

    if (keys.length) {
      const pills = document.createElement("div");
      pills.className = "key-pills";
      for (const k of keys) {
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = "key-pill";
        pill.textContent = k;
        pill.addEventListener("click", () => {
          const current = (step[param.name] ?? []).slice();
          if (!current.includes(k)) current.push(k);
          onStepFieldChange(index, param.name, current);
        });
        pills.appendChild(pill);
      }
      wrap.appendChild(pills);
    }
  } else if (param.type === "key") {
    const input = document.createElement("input");
    input.type = "text";
    input.setAttribute("list", datalistId);
    input.value = step[param.name] ?? "";
    input.addEventListener("change", () => onStepFieldChange(index, param.name, input.value));
    wrap.appendChild(input);
    wrap.appendChild(buildDatalist(datalistId, keys));
  } else if (param.type === "text") {
    const input = document.createElement("input");
    input.type = "text";
    input.value = step[param.name] ?? "";
    input.addEventListener("change", () => onStepFieldChange(index, param.name, input.value));
    wrap.appendChild(input);
  } else if (param.type === "number") {
    const input = document.createElement("input");
    input.type = "number";
    input.value = step[param.name] ?? param.default ?? 0;
    input.addEventListener("change", () => onStepFieldChange(index, param.name, Number(input.value)));
    wrap.appendChild(input);
  } else if (param.type === "select") {
    const select = document.createElement("select");
    for (const opt of param.options) {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      if ((step[param.name] ?? param.default) === opt) o.selected = true;
      select.appendChild(o);
    }
    select.addEventListener("change", () => onStepFieldChange(index, param.name, select.value));
    wrap.appendChild(select);
  } else if (param.type === "code") {
    const textarea = document.createElement("textarea");
    textarea.className = "code-input";
    textarea.placeholder = "data.filter(x => x.active)";
    textarea.value = step[param.name] ?? "";
    textarea.addEventListener("change", () => onStepFieldChange(index, param.name, textarea.value));
    wrap.appendChild(textarea);
  } else if (param.type === "conditions") {
    wrap.appendChild(renderConditionsEditor(step, index, param, keys, datalistId));
  }

  return wrap;
}

function buildDatalist(id, keys) {
  const datalist = document.createElement("datalist");
  datalist.id = id;
  for (const k of keys) {
    const opt = document.createElement("option");
    opt.value = k;
    datalist.appendChild(opt);
  }
  return datalist;
}

function renderConditionsEditor(step, index, param, keys, datalistId) {
  const wrap = document.createElement("div");
  wrap.className = "conditions-editor";
  wrap.appendChild(buildDatalist(datalistId, keys));

  const conditions = step[param.name] ?? [];

  conditions.forEach((cond, ci) => {
    const row = document.createElement("div");
    row.className = "condition-row";

    if (ci > 0) {
      const connSelect = document.createElement("select");
      for (const c of ["AND", "OR"]) {
        const o = document.createElement("option");
        o.value = c;
        o.textContent = c;
        if ((cond.connector ?? "AND") === c) o.selected = true;
        connSelect.appendChild(o);
      }
      connSelect.addEventListener("change", () =>
        updateCondition(step, index, param.name, ci, { connector: connSelect.value }),
      );
      row.appendChild(connSelect);
    }

    const keyInput = document.createElement("input");
    keyInput.type = "text";
    keyInput.placeholder = "field";
    keyInput.setAttribute("list", datalistId);
    keyInput.value = cond.key ?? "";
    keyInput.addEventListener("change", () => updateCondition(step, index, param.name, ci, { key: keyInput.value }));
    row.appendChild(keyInput);

    const opSelect = document.createElement("select");
    for (const op of FILTER_OPERATORS) {
      const o = document.createElement("option");
      o.value = op;
      o.textContent = op;
      if ((cond.operator ?? "=") === op) o.selected = true;
      opSelect.appendChild(o);
    }
    opSelect.addEventListener("change", () => updateCondition(step, index, param.name, ci, { operator: opSelect.value }));
    row.appendChild(opSelect);

    const valueInput = document.createElement("input");
    valueInput.type = "text";
    valueInput.placeholder = "value";
    valueInput.value = cond.value ?? "";
    valueInput.addEventListener("change", () => updateCondition(step, index, param.name, ci, { value: valueInput.value }));
    row.appendChild(valueInput);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () =>
      updatePipeline((steps) => {
        const copy = steps.map((s) => ({ ...s }));
        copy[index][param.name] = copy[index][param.name].filter((_, i) => i !== ci);
        return copy;
      }),
    );
    row.appendChild(removeBtn);

    wrap.appendChild(row);
  });

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "add-condition";
  addBtn.textContent = "+ Add condition";
  addBtn.addEventListener("click", () =>
    updatePipeline((steps) => {
      const copy = steps.map((s) => ({ ...s }));
      copy[index][param.name] = [...(copy[index][param.name] ?? []), { key: "", operator: "=", value: "", connector: "AND" }];
      return copy;
    }),
  );
  wrap.appendChild(addBtn);

  return wrap;
}

function updateCondition(step, index, paramName, ci, patch) {
  updatePipeline((steps) => {
    const copy = steps.map((s) => ({ ...s }));
    const conditions = copy[index][paramName].map((c, i) => (i === ci ? { ...c, ...patch } : c));
    copy[index][paramName] = conditions;
    return copy;
  });
}

// ------------------------------------------------------- export / import

function renderExportImportBar(entry) {
  const bar = document.createElement("div");
  bar.id = "export-import-bar";

  const sampleLabel = document.createElement("label");
  sampleLabel.id = "include-sample-label";
  const sampleCheckbox = document.createElement("input");
  sampleCheckbox.type = "checkbox";
  sampleCheckbox.checked = includeSampleOnExport;
  sampleCheckbox.addEventListener("change", () => {
    includeSampleOnExport = sampleCheckbox.checked;
  });
  sampleLabel.append(sampleCheckbox, " Include sample result (may contain real API data)");

  const exportBtn = document.createElement("button");
  exportBtn.textContent = "Export pipeline";
  exportBtn.disabled = pipelineSteps.length === 0;
  exportBtn.addEventListener("click", () => exportCurrentPipeline(entry));

  const importBtn = document.createElement("button");
  importBtn.textContent = "Import pipeline";
  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = "application/json";
  importInput.style.display = "none";
  importInput.addEventListener("change", () => handleImportFile(importInput.files[0], entry));
  importBtn.addEventListener("click", () => importInput.click());

  bar.append(exportBtn, importBtn, importInput, sampleLabel);

  if (importError) {
    const err = document.createElement("div");
    err.id = "import-error";
    err.textContent = importError;
    bar.appendChild(err);
  }

  return bar;
}

async function exportCurrentPipeline(entry) {
  // Steps always come from the live in-memory pipeline, not storage — the
  // debounced save may not have landed yet. Only id/name/createdAt are
  // borrowed from the stored record, for continuity across exports.
  const stored = pipelineStore && (await pipelineStore.load(entry.urlPattern));
  const record = {
    id: stored?.id ?? "unsaved",
    name: stored?.name ?? entry.urlPattern,
    urlPattern: entry.urlPattern,
    steps: pipelineSteps,
    createdAt: stored?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let samples = {};
  if (includeSampleOnExport) {
    const { result } = await runPipeline(parsedData(entry), pipelineSteps, pipelineHandlerOverrides);
    samples = { [entry.urlPattern]: result };
  }

  const exported = buildExport(record, { includeSample: includeSampleOnExport, samples });
  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sift-pipeline-${entry.urlPattern.replace(/[^a-z0-9]+/gi, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function handleImportFile(file, entry) {
  importError = null;
  if (!file) return;
  try {
    const text = await file.text();
    const [imported] = parseImport(text);
    const validated = validateImportedPipeline(imported, parsedData(entry));
    if (pipelineStore) await pipelineStore.importRecord(validated);
    if (validated.urlPattern === entry.urlPattern) {
      pipelineSteps = validated.steps;
    }
  } catch (err) {
    importError = err.message;
  }
  renderMain();
}

// ------------------------------------------------------- combine (Phase 6)

function renderCombineView() {
  const wrap = document.createElement("div");
  wrap.id = "combine-view";

  const header = document.createElement("div");
  header.id = "combine-header";
  header.textContent = "Combine multiple captured responses";
  wrap.appendChild(header);

  const opSelect = document.createElement("select");
  opSelect.id = "combine-op-select";
  for (const def of COMBINE_OPERATIONS) {
    const opt = document.createElement("option");
    opt.value = def.id;
    opt.textContent = def.label;
    if (def.id === combineOperation) opt.selected = true;
    opSelect.appendChild(opt);
  }
  opSelect.addEventListener("change", () => {
    combineOperation = opSelect.value;
    const def = COMBINE_OPERATIONS_BY_ID[combineOperation];
    if (combineInputs.length > def.maxInputs) combineInputs = combineInputs.slice(0, def.maxInputs);
    render();
  });
  wrap.appendChild(opSelect);

  const def = COMBINE_OPERATIONS_BY_ID[combineOperation];
  const inputsWrap = document.createElement("div");
  inputsWrap.id = "combine-inputs";

  combineInputs.forEach((input, i) => {
    inputsWrap.appendChild(renderCombineInputRow(input, i, def));
  });
  wrap.appendChild(inputsWrap);

  if (combineInputs.length < def.maxInputs) {
    const addBtn = document.createElement("button");
    addBtn.id = "combine-add-input";
    addBtn.textContent = "+ Add input";
    addBtn.addEventListener("click", () => {
      combineInputs = [...combineInputs, { responseId: null, key: "" }];
      render();
    });
    wrap.appendChild(addBtn);
  }

  const { result, error } = computeCombineResult();
  if (error) {
    const err = document.createElement("div");
    err.id = "combine-error";
    err.textContent = error;
    wrap.appendChild(err);
  } else {
    wrap.appendChild(
      renderResultView(result, combineResultViewMode, (m) => {
        combineResultViewMode = m;
        render();
      }),
    );
  }

  return wrap;
}

function renderCombineInputRow(input, index, def) {
  const row = document.createElement("div");
  row.className = "combine-input-row";

  const select = document.createElement("select");
  select.className = "combine-input-select";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Pick a captured response…";
  select.appendChild(placeholder);
  for (const r of capturedResponses) {
    const opt = document.createElement("option");
    opt.value = String(r.id);
    opt.textContent = `${r.url} (${r.urlPattern})`;
    if (r.id === input.responseId) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => {
    combineInputs = combineInputs.map((inp, i) => (i === index ? { ...inp, responseId: Number(select.value) || null } : inp));
    render();
  });
  row.appendChild(select);

  if (def.needsKey) {
    const keyInput = document.createElement("input");
    keyInput.type = "text";
    keyInput.placeholder = def.id === "join" && index === 0 ? "match key (on this base)" : "match key";
    keyInput.value = input.key;
    keyInput.addEventListener("change", () => {
      combineInputs = combineInputs.map((inp, i) => (i === index ? { ...inp, key: keyInput.value } : inp));
      render();
    });
    row.appendChild(keyInput);
  }

  if (def.id === "join" && index > 0) {
    const hint = document.createElement("span");
    hint.className = "combine-nest-hint";
    const response = capturedResponses.find((r) => r.id === input.responseId);
    hint.textContent = response ? `→ nested as "${fieldNameFromUrlPattern(response.urlPattern)}"` : "";
    row.appendChild(hint);
  }

  if (combineInputs.length > 2) {
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => {
      combineInputs = combineInputs.filter((_, i) => i !== index);
      render();
    });
    row.appendChild(removeBtn);
  }

  return row;
}

function computeCombineResult() {
  const def = COMBINE_OPERATIONS_BY_ID[combineOperation];
  const missingPick = combineInputs.some((inp) => inp.responseId == null);
  if (missingPick) return { result: null, error: "Pick a captured response for every input." };
  if (def.needsKey && combineInputs.some((inp) => !inp.key.trim())) {
    return { result: null, error: `${def.label} needs a key for every input.` };
  }

  const inputs = combineInputs.map((inp, i) => {
    const response = capturedResponses.find((r) => r.id === inp.responseId);
    return {
      data: parsedData(response),
      key: inp.key,
      // Only the "many" sides (everything after the base) get nested under
      // a field — auto-named from that input's own urlPattern.
      ...(i > 0 && combineOperation === "join" ? { fieldName: fieldNameFromUrlPattern(response?.urlPattern ?? "") } : {}),
    };
  });

  if (inputs.some((inp) => !Array.isArray(inp.data))) {
    return { result: null, error: "Combine operations need array-of-objects responses." };
  }

  try {
    return { result: runCombine(combineOperation, inputs), error: null };
  } catch (err) {
    return { result: null, error: err.message };
  }
}

render();
