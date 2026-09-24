# Sift

**Filter, map, and combine API response data right inside Chrome DevTools — no code required.**

## The problem

When debugging APIs in DevTools, common tasks like "extract one field from every
item in this array," "filter this list by a status," or "join two responses on a
shared key" all require the same workaround today: right-click a response →
"Store as global variable" → drop into Console → hand-write `.map()`/`.filter()`.
It works, but it's typing the same handful of JS patterns over and over.

## What Sift does

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

## Install

Not yet on the Chrome Web Store — for now, load it unpacked:

1. Clone this repo, then run `npm install && npm run build`
2. Open `chrome://extensions` and turn on **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder
4. Open DevTools on any page that makes JSON API calls and find the **Sift**
   tab, next to Elements/Console/Network

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

## Open source

Sift is MIT-licensed and free to fork, modify, and build on. It's a
standalone tool, not tied to any one employer's internal APIs — released the
same way as [Auto Clicker – Auto Fill](https://getautoclicker.com), so it
stays portable, personally owned, and useful to anyone pointing it at their
own APIs.

Pre-1.0 and actively developed — [PLAN.md](PLAN.md) and [SPEC.md](SPEC.md)
have the detailed build log and open design questions, if you're curious.

## Contributing

Bug reports and PRs are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for
dev setup, tests, and the ground rules. Participation is governed by the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Security

See [SECURITY.md](SECURITY.md) — short version: this extension has no
network permissions and makes no network calls of its own, so most classic
web vulnerability classes don't apply, but responsible disclosure is still
welcome for anything that does.

## License

[MIT](LICENSE)
