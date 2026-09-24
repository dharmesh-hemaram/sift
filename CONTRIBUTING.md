# Contributing to Sift

Thanks for considering it. Sift is a small, single-maintainer project, so
please open an issue to discuss anything non-trivial before sending a PR —
it saves both of us time if the approach needs to change.

## Before you start

Read [README.md](README.md) for what/why, [SPEC.md](SPEC.md) for the
functional spec (including what's explicitly still undecided), and
[PLAN.md](PLAN.md) for the build sequence and what's already done.

## The one hard rule

**Do not design or implement the multi-response "connection points" /
join-visualization UI** (SPEC.md §2, PLAN.md Phase 6) without opening an
issue and getting explicit sign-off first. The current combine picker
(plain dropdowns, no visual connector diagram) is a deliberate interim
design — see PLAN.md's Phase 6 notes for the history. A PR that adds a
wire/connector-diagram UI without that discussion will be declined, not
because the idea is bad, but because the design hasn't happened yet.

A few other things baked into how this project works, not just style
preferences:

- **Nothing leaves the browser.** No analytics, no telemetry, no remote
  calls of any kind. The entire trust model rests on this.
- **Only pipeline structure is ever persisted** (steps + urlPattern) via
  `chrome.storage.local` — never captured response _data_.
- **Export defaults to structure-only.** Sample data is only ever included
  behind an explicit, off-by-default opt-in with a warning.

## Dev setup

```bash
npm install
npm run build   # tsc + sass + copy static assets -> dist/
```

Then load `dist/` as an unpacked extension: `chrome://extensions` → enable
Developer mode → **Load unpacked** → select `dist/`. Reload the extension
after every `npm run build` to pick up changes.

See README.md's **Architecture** section for how `src/` is organized before
touching anything — it's a deliberate split (state / actions / capture /
persistence / sandbox bridge / render / ui), not an accident.

## Before opening a PR

```bash
npm run typecheck    # tsc --noEmit
npm run lint          # eslint .
npm run format:check  # prettier --check .
npm run test:unit     # node:test against src/lib/*.ts directly, no build needed
npm run test:e2e      # builds dist/, then Playwright drives the real unpacked extension
```

All five should pass. If you're adding a new operation to the catalog
(`src/lib/ops.ts` + `src/lib/pipeline.ts`'s `OP_DEFINITIONS`) or a new
combine operation (`src/lib/combine.ts`), add unit tests for the pure logic
in `test/unit/` — that's where almost all the coverage lives, and it runs in
milliseconds with no browser. Reserve `test/e2e/` for things that can only
be verified in a real DOM (see `test/e2e/README.md` for what it can and
can't do).

## Commit messages / PRs

Explain the _why_, not just the _what_ — especially for anything touching
the trust model or the pipeline/combine engines. Keep PRs focused; a
refactor and a feature in the same PR makes both harder to review.
