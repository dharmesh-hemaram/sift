import { escapeHtml, highlightJson } from "../lib/format.ts";
import { flattenObject } from "../lib/ops.ts";

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

interface HeaderNode {
  label: string;
  path?: string;
  children: HeaderNode[];
}

function buildGroupedHeader(headers: string[]): { thead: HTMLTableSectionElement; leafHeaders: string[] } {
  const root: HeaderNode = { label: "", children: [] };

  for (const header of headers) {
    let parent = root;
    for (const label of header.split(".")) {
      let node = parent.children.find((child) => child.label === label);
      if (!node) {
        node = { label, children: [] };
        parent.children.push(node);
      }
      parent = node;
    }
    parent.path = header;
  }

  const leafNodes: HeaderNode[] = [];
  const collectLeaves = (node: HeaderNode): void => {
    if (node.children.length === 0) {
      leafNodes.push(node);
      return;
    }
    node.children.forEach(collectLeaves);
  };
  root.children.forEach(collectLeaves);

  const maxDepth = Math.max(...leafNodes.map((leaf) => leaf.path?.split(".").length ?? 1));
  const rows = Array.from({ length: maxDepth }, () => document.createElement("tr"));
  const appendNode = (node: HeaderNode, depth: number): number => {
    const descendantCount = node.children.length
      ? node.children.reduce((count, child) => count + appendNode(child, depth + 1), 0)
      : 1;
    const th = document.createElement("th");
    th.textContent = node.label;
    if (node.children.length) th.colSpan = descendantCount;
    else th.rowSpan = maxDepth - depth;
    rows[depth]!.appendChild(th);
    return descendantCount;
  };

  root.children.forEach((node) => appendNode(node, 0));

  const thead = document.createElement("thead");
  rows.forEach((row) => thead.appendChild(row));
  return { thead, leafHeaders: leafNodes.map((leaf) => leaf.path ?? leaf.label) };
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
      // Nested objects (e.g. a user's `address`) split into their own
      // dot-path columns (`address.street`, `address.geo.lat`, ...) instead
      // of dumping the whole nested object into one cell as a JSON blob.
      // flattenObject recurses as deep as the data actually is — no
      // artificial depth cap — but leaves arrays alone (no fixed shape to
      // make columns out of), so those still render as a single JSON cell.
      const flatRows = (data as Record<string, unknown>[]).map((row) => flattenObject(row));
      const headers = [...new Set(flatRows.flatMap((row) => Object.keys(row)))];
      const { thead, leafHeaders } = buildGroupedHeader(headers);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      for (const row of flatRows) {
        const tr = document.createElement("tr");
        tr.innerHTML = leafHeaders.map((h) => `<td>${escapeHtml(cellText(row[h]))}</td>`).join("");
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
    const flat = flattenObject(data as Record<string, unknown>);
    const table = document.createElement("table");
    table.className = "result-table";
    table.innerHTML = `<thead><tr><th>key</th><th>value</th></tr></thead><tbody>${Object.entries(flat)
      .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(cellText(v))}</td></tr>`)
      .join("")}</tbody>`;
    return table;
  }

  const p = document.createElement("div");
  p.className = "table-empty";
  p.textContent = String(data);
  return p;
}
