<p align="center">
  <a href="https://github.com/dharmesh-hemaram/sift">
    <img src="src/icons/icon128.png" alt="Sift logo" width="96" height="96">
  </a>
</p>

<h3 align="center">Sift</h3>

<p align="center">
  Filter, map, and combine API response data right inside Chrome DevTools — no code required.
  <br>
  <a href="https://github.com/dharmesh-hemaram/sift/issues/new">Report bug</a>
  ·
  <a href="https://github.com/dharmesh-hemaram/sift/issues/new">Request feature</a>
  ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/manifest-v3-orange.svg" alt="Manifest V3">
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6.svg" alt="TypeScript strict">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome">
</p>

When debugging APIs in DevTools, common tasks like "extract one field from
every item in this array," "filter this list by a status," or "join two
responses on a shared key" all require the same workaround today:
right-click a response → "Store as global variable" → drop into Console →
hand-write `.map()`/`.filter()`. It works, but it's typing the same handful
of JS patterns over and over. Sift adds a panel that does it by clicking
instead.

## Table of contents

- [Quick start](#quick-start)
- [What's included](#whats-included)
- [How it works](#how-it-works)
- [Bugs and feature requests](#bugs-and-feature-requests)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Versioning](#versioning)
- [Creator](#creator)
- [Copyright and license](#copyright-and-license)

## Quick start

Not yet on the Chrome Web Store — for now, build and load it unpacked:

```bash
git clone https://github.com/dharmesh-hemaram/sift.git
cd sift
npm install && npm run build
```

Then:

1. Open `chrome://extensions` and turn on **Developer mode**
2. Click **Load unpacked** and select the `dist/` folder
3. Open DevTools on any page that makes JSON API calls and find the **Sift**
   tab, next to Elements/Console/Network

## What's included

- **Auto-captures every JSON response** DevTools sees — no setup, just open the panel
- **Builds a chain of operations by clicking, not typing**: extract fields,
  filter, sort, group, count, aggregate, dedupe, flatten, convert to CSV, and
  more — picked from dropdowns
- **Ships an escape hatch** for the one time in ten a dropdown isn't enough: a
  custom JS expression step, sandboxed so it can't touch anything else in the
  extension
- **Shows results live** as a table or raw JSON, and lets you export a
  pipeline as a portable JSON file so a teammate doesn't have to rebuild it
  from scratch
- **Combines multiple captured responses** — concat, merge, join by key
  (nested under the matching row, not duplicated across it), diff, or
  intersect
- **Remembers your pipeline per endpoint**, so re-hitting the same API during
  a debugging session doesn't mean rebuilding your steps
- **Runs 100% locally** — no network permissions, no telemetry, no analytics,
  nothing to trust beyond reading the source

## How it works

1. Open the **Sift** tab and reload the page (or trigger some API calls) —
   every JSON response shows up in the left rail, same idea as the Network
   tab: name, status, size.
2. Click a response, then **+ Add step** to start chaining operations. Each
   step is a small card you can reorder or remove.
3. Watch the result update live as a **Table** or **Raw** JSON view.
4. Need two responses together? Click **Combine**, pick an operation (join,
   concat, diff, …) and which captured responses feed it.
5. Happy with a pipeline? **Export** it to a JSON file — a teammate can
   **Import** it against their own capture of the same endpoint.

## Bugs and feature requests

Have a bug or a feature request? Please first
[search for existing and closed issues](https://github.com/dharmesh-hemaram/sift/issues).
If your problem or idea isn't addressed yet,
[open a new issue](https://github.com/dharmesh-hemaram/sift/issues/new).

## Documentation

There's no separate docs site — the repo doubles as the spec:

- [SPEC.md](SPEC.md) — the full functional spec, including what's still
  explicitly undecided
- [PLAN.md](PLAN.md) — build sequence and detailed build log, phase by phase

## Contributing

Bug reports and PRs are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for
dev setup, tests, and the ground rules (there's exactly one hard rule).
Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Versioning

Sift follows [Semantic Versioning](https://semver.org/) once it hits 1.0.
Until then (currently `0.x`), breaking changes can land in a minor bump.

## Creator

**Dharmesh Hemaram**

- <https://github.com/dharmesh-hemaram>

Built as a standalone tool, not tied to any one employer's internal APIs —
released the same way as
[Auto Clicker – Auto Fill](https://getautoclicker.com), so it stays
portable, personally owned, and useful to anyone pointing it at their own
APIs.

## Copyright and license

Code released under the [MIT License](LICENSE). See [SECURITY.md](SECURITY.md)
for the trust model and how to report a vulnerability.
