# PLAN.md — Build Sequence

Each phase should be a working, testable increment. Don't start a phase
until the previous one runs end-to-end.

## Phase 0 — Skeleton ✅

- Manifest V3, `devtools_page`, register a panel via
  `chrome.devtools.panels.create()`.
- Panel just proves capture works: list every JSON response seen
  (`onRequestFinished` + `getContent()`), show URL + status + size in a
  left-rail list. No operations yet.

## Phase 1 — Single response viewer ✅

- Click a captured response → show it as a raw formatted JSON tree in the
  main panel area.

## Phase 2 — Operations menu v1 (highest-value 3) ✅

- Extract field(s), Filter, Sort — as chainable pipeline chips.
- Result view: Table + Raw (Tree can wait).
- Custom-expression escape hatch included from the start (SPEC.md §2).
- Note: Manifest V3's extension-page CSP blocks `new Function`/`eval`
  outright (`'unsafe-eval'` is not allowed for `script-src 'self'`), which
  broke the custom-expression escape hatch as originally written. Fixed by
  running it in a `sandbox`-declared page (`src/sandbox.html`/`sandbox.js`),
  Chrome's documented mechanism for this exact situation — an isolated page
  with a relaxed CSP that trades away all `chrome.*` API access. Talks to
  `panel.js` over `postMessage` only, never a network call.

## Phase 3 — Remaining single-response/object operations ✅

- Group by, count by, unique, duplicates, aggregate, slice, deep search,
  flatten array, CSV/dictionary export (arrays).
- Pick/omit, flatten object, get-by-path, list keys (objects).

## Phase 4 — Persistence ✅

- Save pipeline per `urlPattern` (SPEC.md §3) to `chrome.storage.local`.
- Re-hitting the same endpoint auto-loads its saved pipeline.
- Resolved the state-preservation-vs-recipe open question as
  state-preservation-by-default: each `urlPattern` keeps its own
  independently persisted pipeline, so switching between previously-seen
  endpoints naturally restores where you left off, with no separate
  in-memory juggling needed.

## Phase 5 — Export / Import ✅

- Structure-only export by default; explicit opt-in checkbox for including
  a sample **result** (the computed pipeline output, never the raw captured
  response) (SPEC.md §5).
- Import validates each step's key(s) against the currently loaded
  response's shape; a step referencing a missing key is marked broken and
  shown (not silently dropped or emptied).

## Phase 6 — Multi-response combine ✅ (interim design, signed off 2026-09-24)

- Dharmesh signed off on the plain-dropdown-picker interim approach — no
  visual connector diagram, per SPEC.md §2's warning.
- Implemented: Concat, Merge by index, and Join by key (uncapped); Diff and
  Intersect capped at exactly 2 inputs as specified. A "Combine" toggle in
  the rail header switches `#main` to the picker: operation dropdown, N
  input rows (dropdown over currently-captured responses + a key field
  where the op needs one), Table/Raw result view (reusing the
  single-response pipeline's view).
- **Join by key is a nested join, not a flat pairwise one.** The first
  input tried was users+posts, and a flat SQL-style equi-join (one row per
  matching _pair_) duplicated every user once per post — surprising and not
  what was wanted. Fixed: entries[0] is the "base" (one row per base item,
  kept even with zero matches); every later entry nests its matches into an
  array field on that base row, auto-named from that input's own urlPattern
  (`/posts` → `"posts"`, `/api/v2/accounts/:id` → `"accounts"`). N inputs
  each nest independently under the same base (a star join), not chained
  through one another.
- Deliberately **not persisted** — combine setups are session-only, computed
  live from the current dropdown picks. SPEC.md §3's combine-pipeline JSON
  shape (`inputUrlPatterns`/`operation`/`params`) was written for a
  persisted version; this rough pass doesn't save/export/import combine
  setups. Revisit if that turns out to matter in practice.

## Phase 7 — Out of scope for this project phase

- WebSocket/event-stream capture and summarization. Separate track, not
  started until v1 above is validated.

## Follow-ups (post Phase 6, not part of the original phase list)

- **Manage sifts screen ✅ (2026-09-25).** A third rail-header toggle
  ("Manage", alongside Combine) switches `#main` to a screen listing every
  saved sift across all endpoints (not just the currently selected
  response's) — name (editable), endpoint, step count, last updated, and
  Open/Delete actions. Renaming reuses `storage.ts`'s existing `save()` with
  the same steps and a new name; no new storage method needed. "Open" is
  disabled when there's no currently-captured response for that endpoint,
  since the single-response view needs sample data to run the sift against.
- **User-facing terminology: "sift" not "pipeline" (2026-09-25).** Buttons,
  labels, and error messages shown to the user say "sift" (Export sift,
  Import sift, Manage sifts, the export filename `sift-<endpoint>.json`),
  matching the product name. Internal code identifiers (`pipelineSteps`,
  `PipelineRecord`, `lib/pipeline.ts`, `runPipeline`, the
  `sift.pipelines.v1` storage key, etc.) were deliberately left alone — pure
  internal-naming rename with no user-visible benefit, and a much bigger,
  separate refactor if it's ever wanted.

## Future ideas (not started — parking lot only, do not implement without discussion first)

- **Response-match notifications/subscriptions.** Let a saved sift "watch"
  future captures matching a condition and surface a notification when one
  hits — e.g. "notify me if a POST to this endpoint comes back as a
  failure." Sketch only: what the match condition looks like (status code?
  a filter step evaluating truthy? something new?), where "subscribed"
  sifts are shown, and how a notification is actually surfaced (a DevTools
  panel badge, a `chrome.notifications` popup — which is a permission bump
  and worth weighing against the "100% local, minimal permissions" trust
  model) are all open. Raised by Dharmesh 2026-09-25; needs real design
  before any of it gets built.

## Testing data note

No production API access assumed for development. Use public APIs (GitHub
API, JSONPlaceholder, Stripe test mode) or Auto Clicker's own API traffic as
test fixtures — see `CLAUDE.md`.
