import { state } from "../state.ts";
import { updatePipeline } from "../actions.ts";
import { OP_DEFINITIONS, OP_DEFINITIONS_BY_ID, runPipeline, detectKeys } from "../lib/pipeline.ts";
import { FILTER_OPERATORS } from "../lib/ops.ts";
import { validateImportedPipeline } from "../lib/exportImport.ts";
import { escapeHtml } from "../lib/format.ts";
import { pipelineHandlerOverrides } from "../sandboxBridge.ts";
import { renderResultView, renderRawView } from "./resultView.ts";
import { renderExportImportBar } from "./exportImportBar.ts";
import { scheduleMainRender } from "../renderBus.ts";
import type {
  CapturedResponse,
  FilterCondition,
  OpParamDef,
  PipelineStep,
  StepResult,
  ValidatedStep,
} from "../types.ts";

// Assembles the single-response view: header, pipeline bar, broken-step
// banner (if any), export/import bar, and the result (raw JSON when there
// are no steps yet, otherwise the Table/Raw result view). Async because
// building the pipeline bar and running the pipeline both may call into the
// sandboxed custom-expression evaluator.
export async function renderSingleResponseView(entry: CapturedResponse, data: unknown): Promise<HTMLElement[]> {
  const header = document.createElement("div");
  header.id = "json-view-header";
  header.textContent = entry.url;
  header.title = entry.url;

  const pipelineBar = await renderPipelineBar(data);
  const { result, stepResults } = await runPipeline(data, state.pipelineSteps, pipelineHandlerOverrides);
  const validated = validateImportedPipeline({ steps: state.pipelineSteps, urlPattern: entry.urlPattern }, data);
  const brokenBanner = buildBrokenBanner(state.pipelineSteps, stepResults, validated.steps);
  const exportImportBar = renderExportImportBar(entry);
  const resultNode =
    state.pipelineSteps.length === 0
      ? renderRawView(data)
      : renderResultView(result, state.resultViewMode, (m) => {
          state.resultViewMode = m;
          scheduleMainRender();
        });

  const children = [header, pipelineBar];
  if (brokenBanner) children.push(brokenBanner);
  children.push(exportImportBar, resultNode);
  return children;
}

function buildBrokenBanner(
  steps: PipelineStep[],
  stepResults: StepResult[],
  validatedSteps: ValidatedStep[],
): HTMLElement | null {
  const messages: string[] = [];
  stepResults.forEach((sr, i) => {
    if (sr.broken)
      messages.push(`Step ${i + 1} (${OP_DEFINITIONS_BY_ID[steps[i]?.op ?? ""]?.label ?? steps[i]?.op}): ${sr.error}`);
  });
  validatedSteps.forEach((s, i) => {
    if (s.broken && !stepResults[i]?.broken) {
      messages.push(
        `Step ${i + 1} (${OP_DEFINITIONS_BY_ID[s.op]?.label ?? s.op}): key not found in this response — ${s.missingKeys.join(", ")}`,
      );
    }
  });
  if (!messages.length) return null;
  const banner = document.createElement("div");
  banner.id = "broken-banner";
  banner.innerHTML = messages.map((m) => `<div>${escapeHtml(m)}</div>`).join("");
  return banner;
}

async function renderPipelineBar(originalData: unknown): Promise<HTMLElement> {
  const bar = document.createElement("div");
  bar.id = "pipeline-bar";

  let running = originalData;
  for (let i = 0; i < state.pipelineSteps.length; i++) {
    const inputAtStep = running;
    const { result: afterStep } = await runPipeline(
      originalData,
      state.pipelineSteps.slice(0, i + 1),
      pipelineHandlerOverrides,
    );
    bar.appendChild(renderStepChip(state.pipelineSteps[i]!, i, inputAtStep));
    running = afterStep;
  }

  bar.appendChild(renderAddStep());
  return bar;
}

function renderAddStep(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "add-step";

  const select = document.createElement("select");
  select.className = "add-step-select";
  const placeholder = document.createElement("option");
  placeholder.textContent = "+ Add step…";
  placeholder.value = "";
  select.appendChild(placeholder);

  for (const category of ["array", "object", "custom"] as const) {
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
    const step: PipelineStep = { op: def.id };
    for (const p of def.params)
      step[p.name] = p.default ?? (p.type === "keys" ? [] : p.type === "conditions" ? [] : "");
    updatePipeline((steps) => [...steps, step]);
  });

  wrap.appendChild(select);
  return wrap;
}

function renderStepChip(step: PipelineStep, index: number, inputData: unknown): HTMLElement {
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
      [copy[index - 1], copy[index]] = [copy[index]!, copy[index - 1]!];
      return copy;
    }),
  );

  const downBtn = document.createElement("button");
  downBtn.textContent = "↓";
  downBtn.title = "Move later";
  downBtn.disabled = index === state.pipelineSteps.length - 1;
  downBtn.addEventListener("click", () =>
    updatePipeline((steps) => {
      const copy = [...steps];
      [copy[index], copy[index + 1]] = [copy[index + 1]!, copy[index]!];
      return copy;
    }),
  );

  const removeBtn = document.createElement("button");
  removeBtn.textContent = "×";
  removeBtn.title = "Remove step";
  removeBtn.className = "step-chip-remove";
  removeBtn.addEventListener("click", () => updatePipeline((steps) => steps.filter((_, i) => i !== index)));

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

function onStepFieldChange(index: number, name: string, value: unknown): void {
  updatePipeline((steps) => {
    const copy = steps.map((s) => ({ ...s }));
    copy[index]![name] = value;
    return copy;
  });
}

function renderParamControl(step: PipelineStep, index: number, param: OpParamDef, inputData: unknown): HTMLElement {
  const wrap = document.createElement("label");
  wrap.className = "param-control";
  wrap.dataset["paramType"] = param.type;

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
    input.value = ((step[param.name] as string[] | undefined) ?? []).join(", ");
    input.addEventListener("change", () =>
      onStepFieldChange(
        index,
        param.name,
        input.value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
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
          const current = ((step[param.name] as string[] | undefined) ?? []).slice();
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
    input.value = (step[param.name] as string | undefined) ?? "";
    input.addEventListener("change", () => onStepFieldChange(index, param.name, input.value));
    wrap.appendChild(input);
    wrap.appendChild(buildDatalist(datalistId, keys));
  } else if (param.type === "text") {
    const input = document.createElement("input");
    input.type = "text";
    input.value = (step[param.name] as string | undefined) ?? "";
    input.addEventListener("change", () => onStepFieldChange(index, param.name, input.value));
    wrap.appendChild(input);
  } else if (param.type === "number") {
    const input = document.createElement("input");
    input.type = "number";
    input.value = String((step[param.name] as number | undefined) ?? param.default ?? 0);
    input.addEventListener("change", () => onStepFieldChange(index, param.name, Number(input.value)));
    wrap.appendChild(input);
  } else if (param.type === "select") {
    const select = document.createElement("select");
    for (const opt of param.options ?? []) {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      if (((step[param.name] as string | undefined) ?? param.default) === opt) o.selected = true;
      select.appendChild(o);
    }
    select.addEventListener("change", () => onStepFieldChange(index, param.name, select.value));
    wrap.appendChild(select);
  } else if (param.type === "code") {
    const textarea = document.createElement("textarea");
    textarea.className = "code-input";
    textarea.placeholder = "data.filter(x => x.active)";
    textarea.value = (step[param.name] as string | undefined) ?? "";
    textarea.addEventListener("change", () => onStepFieldChange(index, param.name, textarea.value));
    wrap.appendChild(textarea);
  } else if (param.type === "conditions") {
    wrap.appendChild(renderConditionsEditor(step, index, param, keys, datalistId));
  }

  return wrap;
}

function buildDatalist(id: string, keys: string[]): HTMLDataListElement {
  const datalist = document.createElement("datalist");
  datalist.id = id;
  for (const k of keys) {
    const opt = document.createElement("option");
    opt.value = k;
    datalist.appendChild(opt);
  }
  return datalist;
}

function renderConditionsEditor(
  step: PipelineStep,
  index: number,
  param: OpParamDef,
  keys: string[],
  datalistId: string,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "conditions-editor";
  wrap.appendChild(buildDatalist(datalistId, keys));

  const conditions = (step[param.name] as FilterCondition[] | undefined) ?? [];

  conditions.forEach((cond, ci) => {
    const row = document.createElement("div");
    row.className = "condition-row";

    if (ci > 0) {
      const connSelect = document.createElement("select");
      for (const c of ["AND", "OR"] as const) {
        const o = document.createElement("option");
        o.value = c;
        o.textContent = c;
        if ((cond.connector ?? "AND") === c) o.selected = true;
        connSelect.appendChild(o);
      }
      connSelect.addEventListener("change", () =>
        updateCondition(index, param.name, ci, { connector: connSelect.value as "AND" | "OR" }),
      );
      row.appendChild(connSelect);
    }

    const keyInput = document.createElement("input");
    keyInput.type = "text";
    keyInput.placeholder = "field";
    keyInput.setAttribute("list", datalistId);
    keyInput.value = cond.key ?? "";
    keyInput.addEventListener("change", () => updateCondition(index, param.name, ci, { key: keyInput.value }));
    row.appendChild(keyInput);

    const opSelect = document.createElement("select");
    for (const op of FILTER_OPERATORS) {
      const o = document.createElement("option");
      o.value = op;
      o.textContent = op;
      if ((cond.operator ?? "=") === op) o.selected = true;
      opSelect.appendChild(o);
    }
    opSelect.addEventListener("change", () =>
      updateCondition(index, param.name, ci, { operator: opSelect.value as FilterCondition["operator"] }),
    );
    row.appendChild(opSelect);

    const valueInput = document.createElement("input");
    valueInput.type = "text";
    valueInput.placeholder = "value";
    valueInput.value = cond.value ?? "";
    valueInput.addEventListener("change", () => updateCondition(index, param.name, ci, { value: valueInput.value }));
    row.appendChild(valueInput);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () =>
      updatePipeline((steps) => {
        const copy = steps.map((s) => ({ ...s }));
        copy[index]![param.name] = (copy[index]![param.name] as FilterCondition[]).filter((_, i) => i !== ci);
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
      const existing = (copy[index]![param.name] as FilterCondition[] | undefined) ?? [];
      copy[index]![param.name] = [...existing, { key: "", operator: "=", value: "", connector: "AND" }];
      return copy;
    }),
  );
  wrap.appendChild(addBtn);

  return wrap;
}

function updateCondition(index: number, paramName: string, ci: number, patch: Partial<FilterCondition>): void {
  updatePipeline((steps) => {
    const copy = steps.map((s) => ({ ...s }));
    const conditions = (copy[index]![paramName] as FilterCondition[]).map((c, i) =>
      i === ci ? { ...c, ...patch } : c,
    );
    copy[index]![paramName] = conditions;
    return copy;
  });
}
