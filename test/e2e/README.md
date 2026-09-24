# E2E tests

Real Chromium, real unpacked extension (`--load-extension`), real DOM —
these are not a mock.

## What this can't do

Chrome's actual DevTools UI (the F12 window) isn't scriptable by Playwright
or any other external automation tool — it's privileged browser chrome, not
a normal page. So these tests can't literally open DevTools and click the
Sift tab.

## What they do instead

They navigate straight to `chrome-extension://<id>/panel.html` as a normal
tab. Everything in `panel.js` runs exactly as it does for real, with one
exception: `chrome.devtools.network` doesn't exist outside a real DevTools
host, so there's nothing to auto-capture responses from. `panel.js` detects
that and exposes `window.__sift.handleRequestFinished` instead — the exact
same handler `chrome.devtools.network.onRequestFinished` would call, just
invoked directly from the test with a fake `request`-shaped object. From
that point on (capture, pipeline building, storage, export/import, the
sandboxed custom-expression eval) it's all real code, real clicks, real
`chrome.storage.local`.

`fixtures.js` launches a headed (not headless) persistent Chromium context
— MV3 extensions loaded via `--load-extension` don't fully initialize under
headless mode, and `chrome://extensions` navigation (used to read the
assigned extension ID) is blocked there too. Running the e2e suite will
briefly show a real Chrome window.

## What's covered where

- **Unit tests** (`test/unit/`, Node's built-in test runner) cover the
  operations catalog, pipeline engine, storage, export/import — pure logic,
  fast, no browser.
- **E2E tests** (here) cover the things unit tests can't: real DOM
  rendering, real click/input wiring, real `chrome.storage.local`
  persistence across a reload, and the sandboxed-iframe custom-expression
  path (Manifest V3's page CSP blocks `new Function` directly — this can
  only be proven from inside a real extension context, see `src/sandbox.js`).
