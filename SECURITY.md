# Security Policy

## Trust model

Sift's entire value proposition rests on one guarantee: **nothing captured
in the panel ever leaves the browser.**

- No `host_permissions`, no network requests of Sift's own, no analytics, no
  telemetry, no remote calls of any kind — the manifest only requests the
  `storage` permission, used exclusively to persist pipeline _structure_
  (steps + a normalized URL pattern), never captured response data.
- The one place Sift runs dynamic code (the custom-expression escape hatch,
  SPEC.md §2) does so inside a `sandbox`-declared page with no `chrome.*`
  API access, communicating with the panel only via `postMessage` — it
  cannot reach the network or any other part of the extension.
- Export defaults to structure-only; including a sample result requires an
  explicit, off-by-default opt-in with a warning, since sample data may
  contain real API payload content.

Because of this, most classic web vulnerability classes (data exfiltration,
CSRF, SSRF) don't have a surface to act on here. The realistic risk areas
are: the custom-expression sandbox boundary itself, and the import path
(a malicious pipeline-export JSON file executing something unexpected on
import).

## Supported versions

Pre-1.0, single-maintainer project — only the latest version on `main` is
supported. There's no LTS branch.

## Reporting a vulnerability

Please use
[GitHub's private vulnerability reporting](https://github.com/dharmesh-hemaram/sift/security/advisories/new)
for this repository rather than opening a public issue. Include:

- What you found and why it matters (what an attacker could actually do)
- Steps to reproduce
- The affected version/commit

I'll acknowledge reports as promptly as I can for a project this size, and
credit you in the fix unless you'd prefer otherwise.
