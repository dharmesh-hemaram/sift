# Sift

A Chrome DevTools panel that lets you filter, map, and combine API response data
**inline, without leaving DevTools and without typing code.**

## The problem

When debugging APIs in DevTools, common tasks like "extract one field from every
item in this array," "filter this list by a status," or "join two responses on a
shared key" all require the same workaround today: right-click a response →
"Store as global variable" → drop into Console → hand-write `.map()`/`.filter()`.
It works, but it's typing the same handful of JS patterns over and over.

## What this does

Adds a new DevTools panel (next to Elements/Console/Network) that:

- Auto-captures every JSON response DevTools sees, no setup required
- Lets you build a chain of operations (extract, filter, sort, group, etc.) via
  dropdowns and click targets — no code
- Shows the result live as a table/tree, exportable as JSON/CSV
- Can combine multiple responses (join, diff, concat) — scope for this still
  being finalized, see `SPEC.md`
- Runs 100% locally — no data leaves the browser, no network calls, nothing to
  trust beyond reading the source

## Status

Pre-MVP / actively being designed. See `PLAN.md` for build sequence and
`SPEC.md` for the full functional spec, including what's still undecided.

Phases 0–6 are done: capture, the full operations catalog (extract, filter,
sort, group/count/unique/duplicates, aggregate, slice, deep search,
flatten, CSV/dictionary export, pick/omit/flatten-object/get-by-path/list-keys,
and the custom-expression escape hatch), Table/Raw result views, persistence
per endpoint, export/import, and multi-response combine (Concat, Merge by
index, Join by key, Diff, Intersect) via a plain dropdown picker — no visual
connector UI, per the interim design signed off in `PLAN.md`. Phase 7
(WebSocket/event-stream) is explicitly out of scope for now.

## Architecture

`src/` is TypeScript, one file per concern:

- `lib/*.ts` — pure logic (the operations catalog, pipeline engine, combine
  engine, storage, export/import, formatting). No DOM, no `chrome.*` — this
  is what `test/unit/` exercises directly.
- `state.ts` — the single mutable app-state object.
- `actions.ts` — mutations that need persistence/re-render side effects
  (the "controller" layer between UI events and state).
- `capture.ts`, `persistence.ts`, `sandboxBridge.ts` — the three integration
  points with the outside world (`chrome.devtools.network`,
  `chrome.storage.local`, and the sandboxed custom-expression iframe).
- `ui/*.ts` + `render.ts` — build and update the DOM. `render.ts` is the only
  place that decides _when_ to redraw; `renderBus.ts` is a tiny pub/sub so
  action/UI modules can trigger a redraw without an import cycle back into
  `render.ts`.
- `panel.ts` — the ~10-line composition root that wires the above together.

Nothing here is bundled — the browser loads these as native ES modules, so
the file-per-concern split costs nothing at runtime.

## Building

TypeScript compiles to plain JS, SCSS compiles to plain CSS, into `dist/` —
that's the folder Chrome actually loads.

```bash
npm run build       # tsc + sass + copy static assets (manifest, html, icons) into dist/
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm run format      # prettier --write .
```

## Loading the unpacked extension (dev)

1. `npm run build`
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the `dist/` directory of this repo.
5. Open DevTools on any page that makes JSON API calls, find the **Sift**
   panel, and reload the page — captured responses should appear in the left
   rail.

## Testing

```bash
npm run test:unit   # node:test, run directly against src/lib/*.ts — no build step needed
npm run test:e2e    # builds dist/, then Playwright drives the real unpacked extension in real Chromium
npm test            # both
```

Unit tests run straight against the TypeScript source (Node 24 strips types
natively — no transpile step for testing). The e2e suite loads the actual
built extension into a real (briefly visible, headed) Chromium window — see
`test/e2e/README.md` for what it can and can't exercise (it can't drive the
literal DevTools UI; nothing can).

## Why open source

This is being built as a standalone open-source tool (not tied to any one
employer's internal APIs), released the same way as
[Auto Clicker – Auto Fill](https://getautoclicker.com), so it stays portable,
personally owned, and usable by anyone who wants to point it at their own APIs.

## Contributing

Bug reports and PRs are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for
dev setup, tests, and the one hard rule (no visual join/connector UI without
sign-off, see `PLAN.md` Phase 6).

## Security

See [SECURITY.md](SECURITY.md) — short version: this extension has no
network permissions and makes no network calls of its own, so most classic
web vulnerability classes don't apply, but responsible disclosure is still
welcome for anything that does.

## License

[MIT](LICENSE) — matches Auto Clicker's licensing.
