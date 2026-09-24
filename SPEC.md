# SPEC.md — Functional Specification

## Scope for v1

**In scope:** HTTP request/response data captured via the Network tab.
**Explicitly out of scope for v1:** WebSocket / streaming / event-log
summarization. This was deliberately parked as a separate future track — do
not build toward it yet, do not let it influence v1 architecture.

## 1. Capture

- Listen via `chrome.devtools.network.onRequestFinished`.
- For each finished request, check response content-type / attempt
  `JSON.parse` on the body via `request.getContent()`.
- If valid JSON, add to the captured-responses list. Non-JSON responses are
  ignored for v1 (no XML/binary handling yet).
- Each captured response gets a normalized `urlPattern` — the URL with query
  params and obvious path IDs stripped (e.g. `/api/v2/accounts/123` →
  `/api/v2/accounts/:id`). This is the key used for pipeline reuse (see §3).

## 2. Operations catalog

### Array of objects
| Op | Params | Behavior |
|---|---|---|
| Extract field(s) | key(s), multi-select | `arr.map(x => pick(x, keys))` |
| Filter | key, operator (`=,!=,>,<,contains`), value; supports multiple AND/OR rows | `arr.filter(...)` |
| Sort | key, direction | `arr.sort(...)` |
| Group by field | key | returns `{ [value]: items[] }` |
| Count by field | key | group by + count per group |
| Unique values | key | `[...new Set(...)]` |
| Find duplicates | key | groups with length > 1 |
| Aggregate | key, fn (sum/avg/min/max) | reduce |
| Slice first/last N | N | `.slice()` |
| Deep search | free text | recursive match across all string/number leaves |
| Flatten nested array | key | flatMap |
| Convert to CSV | — | header row + rows |
| Convert to dictionary | key | `keyBy(arr, key)` |

### Single object
| Op | Params | Behavior |
|---|---|---|
| Pick keys | multi-select | `pick(obj, keys)` |
| Omit keys | multi-select | `omit(obj, keys)` |
| Flatten nested object | — | dot-path flattening |
| Get by path | dot-path string | safe getter |
| List all keys (deep) | — | recursive key enumeration |

### Custom expression (escape hatch)
- Free-text textarea, runs arbitrary `.map`/`.filter`/`.reduce` against the
  current pipeline input via `new Function`.
- Always present at the bottom of the "add step" list — never remove this
  even once the fixed catalog covers most cases.

### Multi-response combine
| Op | Params | Notes |
|---|---|---|
| Concat | list of inputs | generalizes to N inputs cleanly |
| Merge by index | list of inputs | generalizes to N, less meaningful past 2-3 |
| Join by key | pairs of (input, key) | generalizes to N via pairwise chaining (A⋈B, then result⋈C) |
| Diff | exactly 2 inputs + key | **capped at 2** — N-way diff is a Venn-diagram problem, not a single filter; don't try to generalize this one |
| Intersect | exactly 2 inputs + key | same cap as Diff |

**⚠️ NOT YET DESIGNED — DO NOT BUILD WITHOUT SIGN-OFF:** the UI for specifying
*how* multiple responses connect (referred to as "connection points," like a
table-join diagram) has been raised but explicitly not designed yet. Dharmesh
said not to design this until he confirms. If combine functionality is
reached before this is resolved, implement it with a minimal, boring
dropdown-based input picker (see PLAN.md Phase 6) and stop there — do not
invent a visual connector/wire diagram.

## 3. Pipeline model

A pipeline is keyed to a `urlPattern` (§1), not to an individual captured
response instance. Rationale: different endpoints almost never share a
response shape, so cross-endpoint reuse isn't useful; but repeated hits of
the *same* endpoint (pagination, polling, staging vs. prod) legitimately
share one pipeline.

```json
{
  "id": "uuid",
  "name": "Active accounts by balance",
  "urlPattern": "/api/v2/accounts",
  "steps": [
    { "op": "extract", "keys": ["code", "balance", "status"] },
    { "op": "filter", "key": "status", "operator": "=", "value": "active" },
    { "op": "sort", "key": "balance", "direction": "desc" }
  ],
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Open point (not fully resolved):** exact UI behavior when switching between
*different* endpoints — whether the previous pipeline/result stays visible
untouched (state preservation) vs. something more recipe-like. Leaning
toward state-preservation-by-default per discussion, but treat as a decision
to confirm during Phase 2/4 build, not a settled requirement.

A **combine pipeline** is a separate type, keyed to a set of `urlPattern`s
(N of them), not a single one:

```json
{
  "id": "uuid",
  "name": "Accounts+Orders by code",
  "inputUrlPatterns": ["/api/v2/accounts", "/api/v2/orders"],
  "operation": "join",
  "params": { "keys": ["accountCode", "accountCode"] }
}
```

## 4. Storage

- `chrome.storage.local` for v1 (simplest; `sync` can be considered later if
  cross-device pipeline access becomes a real need — not decided).
- Store only pipeline **structure** (steps + urlPattern), never captured
  response data, in persistent storage.

## 5. Export / Import

- Export target: JSON file download containing one pipeline definition (or
  an array of them). Purpose is teammates not having to rewrite the same
  logic — **not** for sharing captured data.
- Export must default to **structure only**. Including a sample result is a
  separate, explicit, off-by-default checkbox with a warning, since sample
  data may contain real API payload content.
- Import: validate the pipeline's expected keys against the currently loaded
  response. If a step's key doesn't exist in the data, show that step as
  broken/unmatched (greyed out, "key not found in this response") rather
  than silently returning an empty result.
- Ad-hoc share (file/copy-paste string) vs. a browsable team library — not
  decided; v1 only needs to support the file-export/import case.

## 6. UI layout reference

See the ASCII wireframe already produced earlier in discussion (new "Data"
tab; left rail of captured responses; pipeline as a row of removable,
reorderable, chainable chips; result panel with Table/Tree/Raw views). Use
that as the layout reference for Phases 2–4. Do not add the multi-response
connector visualization (§2 warning above).
