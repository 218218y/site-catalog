# Monitoring and security

This project uses two complementary, privacy-oriented Cloudflare layers:
Cloudflare Web Analytics for aggregate visits/Core Web Vitals, and a small
first-party telemetry pipeline only for site-specific actions and operational
errors. The custom pipeline deliberately does not duplicate page views or load
timings already available in Web Analytics. Neither layer adds an advertising
SDK or a persistent visitor profile.

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
| `catalog_open` | Catalog interest | catalog, page number, source |
| `search` | Search quality | query, scope, result count |
| `favorite` | Feature usage | add/remove/clear, catalog/page, count |
| `contact` | Contact intent | phone/email/Gmail |
| `js_error` | Runtime stability | coarse error name/message fingerprint, file, line |
| `image_error` | Missing/broken catalog images | catalog/page, image role |

Each request receives a random, short-lived batch key used only as the Analytics Engine sampling index; it is not reused across requests and cannot identify a visitor.

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
bundle-site-r2-upload cloudflare.bat
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
3. Fill in the account ID and token. `telemetry.env` is ignored by Git and must
   never be uploaded.
4. Run:

```bat
telemetry-report.bat
```

or:

```bat
npm run telemetry:report -- 30
```

The report shows event totals, opened catalogs, searches/no-result searches,
contact and favorite actions, and runtime/image errors. Page traffic and Core
Web Vitals remain in Cloudflare Web Analytics. The SQL API is called once per
report section with a single supported `SELECT`; the Python tool merges the
normalized rows locally instead of using `UNION ALL` or a CTE. One report run
therefore performs six small SQL API read requests, one per section. Each query
uses Analytics Engine's `_sample_interval`, so sampled event counts remain correct.
Error rows are grouped only by physical Analytics Engine columns (`blob1`, `blob9`);
the readable fallback label is derived locally because Analytics Engine does not
allow expressions inside `GROUP BY`.
Use `--json` for machine-readable output.

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
the catalog CDN. Inline JavaScript and inline script attributes are not allowed.
Inline styles remain allowed because the viewer legitimately updates layout and
CSS custom properties at runtime.

`default-src` is intentionally set to `'self'` rather than mixing `'none'` with
compatibility origins that some filtered networks append at the proxy layer.
Every directive that uses `'none'` keeps it as its only source expression.
Frames are limited to `frame-src 'self'`. This keeps the public policy narrow
while allowing a filtered network to append its own local frame origin without
creating an invalid `frame-src 'none'` combination. `worker-src` remains explicit,
and `frame-ancestors 'none'` still prevents any site from embedding this catalog.
Do not add filter-specific domains, `unsafe-inline`, or a console-reported one-off
script hash to the project CSP. An enforcement violation is shown as a red browser
console error by design; changing it to report-only would stop the browser from
blocking the injected code. Hashes injected by a filtering layer are not a stable
site contract and can change between pages or sessions.

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
4. If CSP blocks a legitimate first-party or Cloudflare resource, investigate
   the exact browser console violation and extend the narrowest directive only.
   Messages from `netfree.link`, `internal.netfree.link`, `go-payment.js`, or
   `card-injection.js` are produced by the local filtering layer, not by this
   repository; do not whitelist them in the public site's policy. Never weaken
   `script-src` or `frame-ancestors` as a shortcut.
