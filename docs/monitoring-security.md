# Monitoring and security

This project uses a small, first-party telemetry pipeline designed for a static
Cloudflare Pages site. It does not add an advertising SDK, cookie banner, user
profile, or persistent visitor identifier.

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
| `page_view` | Page/route usage | page, path, catalog, page number |
| `catalog_open` | Catalog interest | catalog, page number, source |
| `search` | Search quality | query, scope, result count |
| `favorite` | Feature usage | add/remove/clear, catalog/page, count |
| `contact` | Contact intent | phone/email/Gmail |
| `js_error` | Runtime stability | coarse error name/message fingerprint, file, line |
| `image_error` | Missing/broken catalog images | catalog/page, image role |
| `page_load` | App-shell performance | load, response and DOM timing |
| `first_catalog_image` | Perceived catalog performance | first image duration and byte sizes |

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
2. Copy `telemetry.env.example` to `telemetry.env`.
3. Fill in the account ID and token. `telemetry.env` is ignored by Git and must
   never be uploaded.
4. Run:

```bat
telemetry-report.bat
```

or:

```bat
npm run telemetry:report -- --days 30
```

The report shows event totals, opened catalogs, searches/no-result searches,
contact and favorite actions, errors, and average performance timings. Its SQL
uses Analytics Engine's `_sample_interval`, so counts and timing averages remain
correct when Cloudflare samples a high-volume dataset. Use `--json` for
machine-readable output.

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

The CSP allows scripts only from the site itself. Images may load from the site,
data/blob URLs needed by the viewer, and the catalog CDN. Connections are
limited to the site and catalog CDN. Inline JavaScript is not allowed. Inline
styles remain allowed because the viewer legitimately updates layout and CSS
custom properties at runtime.

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
4. If CSP blocks a legitimate resource, investigate the exact browser console
   violation and extend the narrowest directive only. Do not weaken
   `default-src`, `script-src`, or `frame-ancestors` as a shortcut.
