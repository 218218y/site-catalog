# Monitoring and security

This project uses two privacy-oriented Cloudflare layers: optional Cloudflare
Web Analytics for its independent browser dashboard, and a small first-party
telemetry pipeline for site-specific actions, operational errors, and coarse
LCP/INP/CLS reporting. The custom pipeline deliberately does not duplicate page
views or navigation/load timings. Neither layer adds an advertising SDK or a
persistent visitor profile.

## Architecture

1. `src/js/15-telemetry.js` records a strict list of operational events.
2. Events are batched and posted to the same-origin endpoint `/api/telemetry`.
3. `functions/api/telemetry.js` validates and sanitizes every field.
4. The Pages Function writes the accepted fields to the Cloudflare Workers
   Analytics Engine binding `SITE_TELEMETRY`.
5. `tools/telemetry_report.py` reads aggregated results through Cloudflare's SQL
   API when an authorized local operator requests a report.

The public deploy bundle still contains only fingerprinted browser assets. The
`functions/` directory and `wrangler.jsonc` remain at the project root so
Wrangler can deploy the Pages Function and its binding together with the static
bundle.

## Collected events

| Event | Purpose | Main fields |
|---|---|---|
| `app_session` | Real denominator for rates and release cohorts | deployment, page, route, viewport, navigation type |
| `catalog_open` | Catalog interest | catalog, page number, source |
| `search` | Completed-search quality | query, scope, result count, submit/result-open |
| `favorite` | Feature usage | add/remove/clear, catalog/page, count |
| `contact` | Contact intent | phone/email/Gmail/copy, source, catalog/page when available |
| `js_error` | Runtime stability | coarse error name/message fingerprint, file, line, deployment ID |
| `resource_error` | Non-image resource loading | provider scope, tag, role, coarse filename, deployment ID |
| `search_index_load_failed` | Search bootstrap failures | reason, trigger, source scope, deployment ID |
| `image_attempt_failed` | One failed catalog-image attempt | frozen request ID, catalog/page, surface, visibility, role, attempt number |
| `image_recovered` | Catalog image recovered after retry/fallback | same frozen request context, successful role, failed-attempt count |
| `image_terminal_failure` | Catalog image exhausted its managed recovery path | same frozen request context, final role, failed-attempt count |
| `image_error` | Historical pre-classification image failures | catalog/page, image role |
| `web_vital` | Coarse real-user LCP/INP/CLS quality | metric name, rating, numeric value, allowlisted component token for LCP/CLS |

Each ingestion request receives a random, short-lived batch key used only as the Analytics Engine sampling index. Each managed image lifecycle receives a separate random request ID that is reused only across its attempt/recovery/terminal events. Neither value persists across page loads or identifies a visitor. Component values come from a closed token map or an explicit sanitized `data-telemetry-component`; arbitrary selectors, HTML, and DOM text are not sent.

The implementation deliberately does **not** read or store cookies, IP address,
User-Agent, full referrer, email address, phone number, error stack, or a
persistent visitor ID. Global Privacy Control and Do Not Track disable browser
telemetry. Localhost and preview hosts do not send events unless a test enables
telemetry explicitly.

## Cloudflare setup and deployment

`wrangler.jsonc` is part of the deployment contract. It defines:

- Pages project: `bargig-catlog`
- static output: `dist/site-upload-r2`
- Analytics Engine binding: `SITE_TELEMETRY`
- dataset: `bargig_catalog_telemetry`

The normal deployment command remains:

```bat
.02-bundle-site-r2-upload cloudflare.bat
```

The deploy tool validates the config, the Function file, the binding, and the
fresh fingerprinted bundle before invoking Wrangler. Do not rename the binding
in only one file; update the config, Function/tests, and this document together.

After the first deployment, verify the endpoint in a browser:

```text
https://bargig-furniture.com/api/telemetry
```

It should return JSON with `ok: true`. `storage: true` confirms that the binding
is available to the Function.

## Reading a report

1. In Cloudflare, create an API token with the minimum account analytics read
   permission needed for Analytics Engine SQL queries.
2. Copy `telemetry.env.example` to a file named exactly `telemetry.env`.
   If an archive or RTL-aware file manager adds hidden direction marks to the
   filename, the report detects one unambiguous copy and asks you to rename it.
3. Fill in the account ID and token. Also set `BARGIG_CURRENT_RELEASE_ID` to the exact
   current production `deploy-...` identifier when available. The tool may use a local deploy
   build-state file, but it does not infer the current release from traffic rows.
   `telemetry.env` is ignored by Git and must never be uploaded.
4. Run:

```bat
.20-telemetry-report.bat
```

or:

```bat
npm run telemetry:report -- 30
```

The report shows event totals, application-session denominators, current/historical/fallback
release cohorts, opened catalogs, completed searches/no-result searches, contact and favorite
actions, provider-level resource failures, and runtime/image diagnostics. RUM is grouped by
release, app page, route, viewport, and component; reliability is expressed per 1,000 matching
sessions. Image outcomes distinguish visible failures from hidden/preload/background work and
preserve one request correlation across the complete recovery lifecycle. Typing prefixes are not
reported; a search event is emitted only after Enter/submit or after opening a result. The SQL API
is called once per report section with a single supported `SELECT`; the Python tool merges the
normalized rows locally instead of using `UNION ALL` or a CTE. The current report performs 21
bounded SQL reads. Each query uses Analytics Engine's `_sample_interval`, so sampled event counts
remain correct.
Error rows are grouped only by physical Analytics Engine columns (`blob1`, `blob9`);
the readable fallback label is derived locally because Analytics Engine does not
allow expressions inside `GROUP BY`.
Use `--format json` for an archived machine-readable file, `--json` for the legacy stdout mode,
or `--current-release deploy-...` to override the configured current production release.

Analytics Engine is intended for aggregated operational analytics rather than a
per-user event log. Cloudflare currently retains Analytics Engine data for
three months; export aggregated summaries separately if longer business
comparisons are required.

## Security headers

`_headers` applies the following to every public route:

- HSTS with subdomains
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy` disabling unused sensitive capabilities
- `X-Frame-Options: DENY`
- CSP `frame-ancestors 'none'`
- `X-Permitted-Cross-Domain-Policies: none`
- a restrictive Content Security Policy

The CSP allows first-party scripts plus Cloudflare's Web Analytics beacon from
`static.cloudflareinsights.com`. Beacon delivery is allowed to the current site
and to `cloudflareinsights.com` for Cloudflare's documented fallback/manual
path. Images may load from the site, data/blob URLs needed by the viewer, and
the catalog CDN. Inline event-handler attributes remain blocked. Inline styles
remain allowed because the viewer legitimately updates layout and CSS custom
properties at runtime.

### Cloudflare Web Analytics beacon failures

Cloudflare's optional Web Analytics script is loaded from
`static.cloudflareinsights.com/beacon.min.js`; the version-looking trailing path such as
`v4513226...` belongs to that beacon. The current CSP already permits both the script host and its
analytics connection. A `resource_error` for this file therefore must not be treated as proof that
the site shell or NetFree integration broke. Tracking blockers and filtered browsing environments
may block it after CSP has already allowed the request.

The browser telemetry now classifies this resource as `cloudflare-observability`, and the report
shows it in a separate card rather than counting it as an actionable shell failure. Do not add
hosts, `unsafe-eval`, or broader inline permissions to silence this optional beacon. If Cloudflare
Web Analytics is no longer useful because first-party telemetry supplies the required operational
signals, disable automatic beacon injection in the Cloudflare dashboard; that is an operational
choice, not a CSP code fix.

### Deployment identity and report integrity

Every build stamps one deterministic `deploy-<16 hex>` identifier into all three route bundles
before they are fingerprinted. Catalog, favorites, and viewer events from one deployment therefore
share one deployment ID instead of being split by route-bundle hashes. The ingestion Function
accepts only known deployment-ID shapes and known viewport buckets; arbitrary values are discarded
rather than creating misleading report buckets.

The report separates verified JavaScript errors from historical blank-release rows, counts release
activity only from `catalog_open`, includes provider/tag/role columns in CSV, and states how many
diagnostic events are omitted by grouping limits.

### NetFree review-card compatibility

NetFree users rely on a browser-side review card for checking filtered images and
requesting a new review. The filtering layer injects a changing inline bootstrap
script and opens a frame from `netfree.link`; a stable hash or a site-generated
nonce cannot authorize that third-party injected code. The enforced policy therefore
contains a deliberately narrow compatibility exception:

- the normal `script-src` remains strict and does **not** contain `unsafe-inline`;
- `script-src-elem` permits inline **script elements** and explicit NetFree hosts;
- `script-src-attr 'none'` continues to block `onclick` and other inline handlers;
- `frame-src` permits only same-origin frames and explicit `netfree.link` frames;
- `frame-ancestors 'none'` and `X-Frame-Options: DENY` still prevent other sites
  from embedding the catalog;
- `unsafe-eval` remains forbidden.

This is a conscious compatibility/security trade-off. Do not broaden the NetFree
wildcards, add arbitrary third-party script hosts, or remove `script-src-attr 'none'`.
The one-off hashes shown in the browser console are not stable and must not be copied
into `_headers`.

`default-src` is intentionally set to `'self'` rather than mixing `'none'` with
compatibility origins that filtered networks may append at the proxy layer. Every
directive that uses `'none'` keeps it as its only source expression. `worker-src`
remains explicit, and `frame-ancestors 'none'` continues to protect against
clickjacking.

The HTTPS redirect was moved to `https-redirect.js`, and the 404 page style was
moved to `404.css`, so the CSP does not need an inline-script exception.

## Maintenance checklist

Before deployment:

```bat
npm run verify
```

After deployment:

1. Open the main site and one catalog.
2. Check `/api/telemetry` reports `storage: true`.
3. After several minutes, run the local telemetry report.
4. In the report, verify that the newest `deploy-...` row receives new catalog opens and that
   image retries appear as attempts/recoveries rather than unmanaged terminal failures.
5. If CSP blocks a legitimate first-party or NetFree review-card resource, investigate the exact
   browser console violation and extend only the existing narrow compatibility directives. A
   blocked `beacon.min.js/v...` resource is Cloudflare observability, not a reason to weaken CSP.
   Never add a changing console hash, `unsafe-eval`, arbitrary external hosts, or weaken
   `frame-ancestors`.

## Report files and long-term archive

PowerShell is not used as the primary Hebrew presentation layer. Running
`.20-telemetry-report.bat 30` or `npm run telemetry:report -- 30` now creates:

- an RTL HTML dashboard under `reports/telemetry` and opens it in the browser;
- an Excel-friendly UTF-8-BOM CSV beside it.

The filenames contain the generation date and time, so periodic reports can be
kept as a simple historical archive. Generated reports are ignored by Git and
must not be uploaded with the public site. Use `--format json` when a machine-
readable export is needed, `--console` only for diagnostic text output, and
`--output-dir PATH` to save the report elsewhere.

Because Analytics Engine retains data for a limited period, a monthly export is
recommended if year-over-year comparisons will matter. The export is aggregated
and does not contain a persistent visitor identifier.

## Completion status

The monitoring scope planned for the public rollout is complete:

- Cloudflare Web Analytics may provide an independent visits/RUM dashboard when its beacon is not blocked;
- application-session denominators, release cohorts, catalog opens, completed searches/no-result searches,
  favorites, contact intent, component-attributed LCP/CLS, INP, JavaScript errors, resource failures,
  and correlated image lifecycle events are covered by first-party telemetry;
- duplicate page-view and page-load events are not sent to Analytics Engine;
- reports can be archived as HTML/CSV;
- the ingestion endpoint validates a strict schema and remains non-blocking if
  storage is unavailable.

The security baseline is also complete for the current static architecture:
HSTS, nosniff, referrer policy, permissions policy, iframe protection, CSP,
external HTTPS redirect code, and production tests are in place. Remaining
items are operational rather than missing baseline controls:

1. Review Web Analytics and the telemetry report after meaningful traffic has
   accumulated, rather than reacting to isolated single samples.
2. Export one monthly report if data beyond Analytics Engine retention is
   important.
3. Add an alert only if error volume becomes high enough to justify it; the
   current traffic level does not need a separate paid monitoring platform.
4. Revisit the CSP only when a legitimate new first-party resource is added.
   Do not relax it to silence scripts injected by a local filtering layer.
