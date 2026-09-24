import { state, parsedData } from "../state.ts";
import { COMBINE_OPERATIONS, COMBINE_OPERATIONS_BY_ID, runCombine, fieldNameFromUrlPattern } from "../lib/combine.ts";
import { renderResultView } from "./resultView.ts";
import { scheduleRender } from "../renderBus.ts";
import type { CombineEntry, CombineInputState, CombineOperationDef, CombineOpId } from "../types.ts";

export function renderCombineView(): HTMLElement {
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
    if (def.id === state.combineOperation) opt.selected = true;
    opSelect.appendChild(opt);
  }
  opSelect.addEventListener("change", () => {
    state.combineOperation = opSelect.value as CombineOpId;
    const def = COMBINE_OPERATIONS_BY_ID[state.combineOperation];
    if (state.combineInputs.length > def.maxInputs) state.combineInputs = state.combineInputs.slice(0, def.maxInputs);
    scheduleRender();
  });
  wrap.appendChild(opSelect);

  const def = COMBINE_OPERATIONS_BY_ID[state.combineOperation];
  const inputsWrap = document.createElement("div");
  inputsWrap.id = "combine-inputs";

  state.combineInputs.forEach((input, i) => {
    inputsWrap.appendChild(renderCombineInputRow(input, i, def));
  });
  wrap.appendChild(inputsWrap);

  if (state.combineInputs.length < def.maxInputs) {
    const addBtn = document.createElement("button");
    addBtn.id = "combine-add-input";
    addBtn.textContent = "+ Add input";
    addBtn.addEventListener("click", () => {
      state.combineInputs = [...state.combineInputs, { responseId: null, key: "" }];
      scheduleRender();
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
      renderResultView(result, state.combineResultViewMode, (m) => {
        state.combineResultViewMode = m;
        scheduleRender();
      }),
    );
  }

  return wrap;
}

function renderCombineInputRow(input: CombineInputState, index: number, def: CombineOperationDef): HTMLElement {
  const row = document.createElement("div");
  row.className = "combine-input-row";

  const select = document.createElement("select");
  select.className = "combine-input-select";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Pick a captured response…";
  select.appendChild(placeholder);
  for (const r of state.capturedResponses) {
    const opt = document.createElement("option");
    opt.value = String(r.id);
    opt.textContent = `${r.url} (${r.urlPattern})`;
    if (r.id === input.responseId) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => {
    state.combineInputs = state.combineInputs.map((inp, i) =>
      i === index ? { ...inp, responseId: Number(select.value) || null } : inp,
    );
    scheduleRender();
  });
  row.appendChild(select);

  if (def.needsKey) {
    const keyInput = document.createElement("input");
    keyInput.type = "text";
    keyInput.placeholder = def.id === "join" && index === 0 ? "match key (on this base)" : "match key";
    keyInput.value = input.key;
    keyInput.addEventListener("change", () => {
      state.combineInputs = state.combineInputs.map((inp, i) => (i === index ? { ...inp, key: keyInput.value } : inp));
      scheduleRender();
    });
    row.appendChild(keyInput);
  }

  if (def.id === "join" && index > 0) {
    const hint = document.createElement("span");
    hint.className = "combine-nest-hint";
    const response = state.capturedResponses.find((r) => r.id === input.responseId);
    hint.textContent = response ? `→ nested as "${fieldNameFromUrlPattern(response.urlPattern)}"` : "";
    row.appendChild(hint);
  }

  if (state.combineInputs.length > 2) {
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => {
      state.combineInputs = state.combineInputs.filter((_, i) => i !== index);
      scheduleRender();
    });
    row.appendChild(removeBtn);
  }

  return row;
}

function computeCombineResult(): { result: unknown; error: string | null } {
  const def = COMBINE_OPERATIONS_BY_ID[state.combineOperation];
  const missingPick = state.combineInputs.some((inp) => inp.responseId == null);
  if (missingPick) return { result: null, error: "Pick a captured response for every input." };
  if (def.needsKey && state.combineInputs.some((inp) => !inp.key.trim())) {
    return { result: null, error: `${def.label} needs a key for every input.` };
  }

  const inputs: CombineEntry[] = state.combineInputs.map((inp, i) => {
    const response = state.capturedResponses.find((r) => r.id === inp.responseId);
    return {
      data: parsedData(response),
      key: inp.key,
      // Only the "many" sides (everything after the base) get nested under
      // a field — auto-named from that input's own urlPattern.
      ...(i > 0 && state.combineOperation === "join"
        ? { fieldName: fieldNameFromUrlPattern(response?.urlPattern ?? "") }
        : {}),
    };
  });

  if (inputs.some((inp) => !Array.isArray(inp.data))) {
    return { result: null, error: "Combine operations need array-of-objects responses." };
  }

  try {
    return { result: runCombine(state.combineOperation, inputs), error: null };
  } catch (err) {
    return { result: null, error: (err as Error).message };
  }
}
