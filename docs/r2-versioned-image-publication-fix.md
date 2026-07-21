# R2 versioned image publication fix

## Observed failure

A catalog image existed at its plain CDN path, while the exact URL carrying the
site's `v` query parameter returned `404`. Other page numbers in the same
catalog worked with their version parameter.

The image itself was therefore not missing from R2. The failed object was the
CDN cache entry for the exact query-string URL.

## Root cause

The previous conversion batch explicitly instructed the operator to build the
site immediately after conversion, before the R2 sync. Generated catalog
metadata and the diagnostic big-pages viewer could therefore advertise a new
image version before the corresponding image release existed on R2. If such a
URL was requested during that window, a CDN could cache the `404` under that
exact query-string key.

The main viewer retried through slower fallbacks, which made affected medium
images appear late and could cause a full-resolution image to be downloaded.
The standalone big-pages viewer had no same-object recovery and left the item
failed.

## Corrective architecture

1. Image versions are content-derived and recorded separately for `thumb`,
   `medium`, and `full`.
2. Public URLs include both the image tier and URL-schema generation, so this
   release does not reuse previously poisoned query keys.
3. A failed versioned image retries the same image tier once through a fresh,
   unversioned request before falling back to a larger or smaller tier.
4. The standalone viewer uses a per-load inspection key and retries the plain
   object URL once.
5. Successful R2 synchronization writes a local release signature. Site builds
   and deploys fail closed when the generated image release no longer matches
   the last successful sync.
6. The deployment gate checks the exact versioned browser URLs with a one-byte
   GET request, rather than checking only the unversioned object paths. It does
   not send a cache-bypass directive, so a stale CDN `404` cannot be hidden from
   the gate by a successful origin fetch.

## Safe publication order

```text
convert images -> sync images to R2 -> build site -> preview -> deploy site
```

For an already-converted and uploaded release, run the real R2 sync command
once. It will verify/apply the plan and record the release signature even when
there are no remaining files to upload. Then build and deploy normally.

## Expected behavior after rollout

Old poisoned URLs may remain failed until their cache entries expire or are
purged. They are no longer emitted by the updated site. The new release uses a
new URL-schema suffix and is deployed only after its exact URLs pass the public
CDN gate.
