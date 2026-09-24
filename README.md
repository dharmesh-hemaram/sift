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

## Loading the unpacked extension (dev)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `src/` directory of this repo.
4. Open DevTools on any page that makes JSON API calls, find the **Sift**
   panel, and reload the page — captured responses should appear in the left
   rail.

## Testing

```bash
npm run test:unit   # node:test over src/lib/* — pure logic, no browser
npm run test:e2e    # Playwright: real Chromium, the real unpacked extension
npm test            # both
```

The e2e suite loads the actual extension into a real (briefly visible,
headed) Chromium window — see `test/e2e/README.md` for what it can and can't
exercise (it can't drive the literal DevTools UI; nothing can).

## Why open source

This is being built as a standalone open-source tool (not tied to any one
employer's internal APIs), released the same way as
[Auto Clicker – Auto Fill](https://getautoclicker.com), so it stays portable,
personally owned, and usable by anyone who wants to point it at their own APIs.

## License

MIT (matches Auto Clicker's licensing — confirm before first release).
