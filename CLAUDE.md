# CLAUDE.md — Instructions for the coding agent

## Read first

`README.md` (what/why), `SPEC.md` (functional spec), `PLAN.md` (build order).
Follow `PLAN.md`'s phase order — don't jump ahead to Phase 6.

## Hard rules — do not violate these

1. **Do not design or implement the multi-response "connection points" /
   join-visualization UI** (SPEC.md §2, PLAN.md Phase 6) without explicit
   sign-off from Dharmesh first. If you reach that phase, stop and ask,
   rather than inventing a visual design. A plain dropdown picker is the
   only acceptable interim implementation if he says to proceed without the
   full design.
2. Never send captured response data anywhere over the network. This tool's
   entire trust model rests on "nothing leaves the browser" — no analytics,
   no telemetry, no remote calls of any kind.
3. Never persist captured response _data_ to `chrome.storage`. Only pipeline
   _structure_ (steps + urlPattern) gets persisted (SPEC.md §4).
4. Export defaults to structure-only. Never bundle sample response data into
   an export unless the user has explicitly opted in for that specific
   export action.

## Tech stack

- Manifest V3.
- TypeScript, one file per concern (see README.md's Architecture section) —
  no framework, no bundler. `tsc` compiles `src/**/*.ts` to `dist/**/*.js`
  (native ES modules, loaded by the browser as-is, no bundling); `sass`
  compiles `panel.scss` to `panel.css`. `npm run build` does both plus
  copies static assets (manifest/html/icons) into `dist/`, which is what
  gets loaded as the unpacked extension — never `src/` directly.
- ESLint (`typescript-eslint`, flat config) + Prettier are configured and
  should stay clean (`npm run lint`, `npm run format:check`).
- Unit tests run directly against `src/lib/*.ts` via Node's native
  TypeScript execution — no build step needed for `npm run test:unit`.
- No backend, no build-time API calls, no external services.

## Repo conventions

- Match Auto Clicker's (Dhruv-Techapps org) existing code style/tooling
  where reasonably possible, for consistency across Dharmesh's projects.
- MIT license, same as Auto Clicker (confirm before first public release).

## Testing without production data

There's no live "own" API to test against yet. Use:

- Public APIs with genuinely nested/messy shapes (GitHub API, JSONPlaceholder)
- Auto Clicker's own backend traffic, if any exists and is accessible
- Locally-served static JSON fixtures for anything not covered by the above

## When you hit an open question not covered here

Check `SPEC.md` for a flagged "open point" first — several exist (pipeline
switch-behavior details, export sharing pattern, storage local vs sync).
Where SPEC.md says something is undecided, implement the simplest version
that unblocks progress and note the assumption in your output — don't block
on it, but don't quietly over-build past it either.
