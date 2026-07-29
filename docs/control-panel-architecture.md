# Catalog control panel architecture

## Boundaries

The control panel has a thin static shell in `catalog-control-panel.html`. Its
styles and browser implementation live under `src/control-panel/` and are part
of the project-wide strict TypeScript/JSDoc check. The page contains no inline
script, style block, or style attribute, so the server can enforce a CSP without
`unsafe-inline`.

The browser sends user intent. It does not own canonical catalog grouping,
taxonomy reconciliation, path normalization, or generated outputs. The Python
server validates DTOs, performs normalization and transactional writes, then
returns a complete versioned `state` payload. Save handlers replace the editable
client state with that canonical response.

## HTTP boundary

`tools/catalog_control_api.py` owns request limits and top-level request DTOs.
JSON requests are limited to 1 MB and PDF multipart requests to 160 MB. The
`Content-Length` limit is checked before the body is read, so oversized requests
receive HTTP 413 without being buffered.

The server binds to loopback by default. A non-loopback bind requires
`--allow-remote`, an explicit host allowlist, and a long token. Host, Origin and
Fetch Metadata checks protect the mutation routes; the browser exchanges a
one-time token URL for an HttpOnly, SameSite=Strict cookie. Remote mode is still
plain HTTP and should only be used on a trusted network or behind a trusted TLS
reverse proxy.

## Conversion profiles

`tools/catalog_conversion_profiles.py` is the single source of truth for render
and OCR defaults. The CLI, control panel and Windows wrappers select one of:

- `production` — incremental production conversion.
- `force` — rebuild all configured catalogs.
- `ocr-refresh` — refresh OCR/search while preserving complete images.

The wrappers contain only environment setup, a profile selection, and truthful
operator messaging. Explicit diagnostic CLI flags may override numeric or text
profile values.

## Missing-PDF deletion contract

A configured missing PDF stops conversion by default and deletes nothing. The
control panel displays the current missing catalog ids and requires explicit
confirmation. Those exact ids are checked twice: first at the HTTP boundary and
again by `build_catalogs.py` under the project mutation lock. A stale
confirmation fails before pruning. Manual CLI pruning remains an explicit
operator action via `--prune-missing-pdfs`.
