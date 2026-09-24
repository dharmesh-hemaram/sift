import { escapeHtml, highlightJson } from "../lib/format.ts";

export function renderRawView(data: unknown): HTMLElement {
  let pretty: string;
  try {
    pretty = JSON.stringify(data, null, 2) ?? String(data);
  } catch {
    pretty = String(data);
  }
  const pre = document.createElement("pre");
  pre.id = "json-view";
  pre.innerHTML = highlightJson(escapeHtml(pretty));
  return pre;
}

export type ResultViewMode = "table" | "raw";

// Generic Table/Raw result view — used by both the single-response pipeline
// and the combine view, each with their own mode state so switching tabs in
// one doesn't affect the other.
export function renderResultView(
  result: unknown,
  mode: ResultViewMode,
  onModeChange: (mode: ResultViewMode) => void,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.id = "result-view";

  const tabs = document.createElement("div");
  tabs.id = "result-tabs";
  for (const m of ["table", "raw"] as const) {
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

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function renderTable(data: unknown): HTMLElement {
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
      const rows = data as Record<string, unknown>[];
      const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
      const thead = document.createElement("thead");
      thead.innerHTML = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      for (const row of rows) {
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
