# ביקורת מראת npm אופליין — Linux x64/glibc

המסמך הוא צילום מצב של `package-lock.json` הנוכחי. פקודת העדכון אינה משתמשת ברשימה זו כמקור אמת; היא מחשבת מחדש את הרשימה מה־lockfile בכל הרצה.

## ממצאים

- חבילות תואמות לסביבת הצ׳אט: **43**.
- tarballs עצמאיים עם `resolved` ו־`integrity`: **37**.
- חבילות bundled ללא tarball נפרד ב־lockfile: **6**.
- חבילות Playwright של Node כלולות; Chromium ודפדפנים אחרים אינם חלק מהמראה.
- אין בפרויקט תלות או פקודת `tsx`. אם היא תתווסף בעתיד ל־lockfile, מנגנון העדכון יאסוף אותה אוטומטית.
- ארכיוני Windows, macOS, ARM64 ו־musl מסוננים ומוסרים בעת עדכון עם prune.

## משפחות קריטיות שנמצאו

| שימוש | חבילות נדרשות |
|---|---|
| בניית frontend | `esbuild`, `@esbuild/linux-x64` |
| בדיקות טיפוסים ו־AST | `typescript`, `@typescript/typescript-linux-x64` |
| Cloudflare/Wrangler | `wrangler`, `workerd`, `@cloudflare/workerd-linux-64`, `miniflare` ותלויותיהן |
| עיבוד תמונה של Wrangler | `sharp`, `@img/sharp-linux-x64`, `@img/sharp-libvips-linux-x64` ותלויות fallback תואמות |
| בדיקות Playwright ללא דפדפן | `@playwright/test`, `playwright`, `playwright-core` |

## מלאי lockfile מסונן

| חבילה | גרסה | מקור אופליין |
|---|---:|---|
| `@cloudflare/kv-asset-handler` | `0.5.0` | bundled בתוך tarball אחר (נבדק בזמן sync) |
| `@cloudflare/unenv-preset` | `2.16.1` | bundled בתוך tarball אחר (נבדק בזמן sync) |
| `@cloudflare/workerd-linux-64` | `1.20260730.1` | tarball מאומת |
| `@cspotcode/source-map-support` | `0.8.1` | tarball מאומת |
| `@emnapi/runtime` | `1.11.3` | tarball מאומת |
| `@esbuild/linux-x64` | `0.28.1` | tarball מאומת |
| `@img/colour` | `1.1.0` | tarball מאומת |
| `@img/sharp-libvips-linux-x64` | `1.3.1` | tarball מאומת |
| `@img/sharp-linux-x64` | `0.35.2` | tarball מאומת |
| `@img/sharp-wasm32` | `0.35.2` | tarball מאומת |
| `@jridgewell/resolve-uri` | `3.1.2` | tarball מאומת |
| `@jridgewell/sourcemap-codec` | `1.5.5` | tarball מאומת |
| `@jridgewell/trace-mapping` | `0.3.9` | tarball מאומת |
| `@playwright/test` | `1.62.1` | tarball מאומת |
| `@poppinss/colors` | `4.1.6` | tarball מאומת |
| `@poppinss/dumper` | `0.6.5` | tarball מאומת |
| `@poppinss/exception` | `1.2.3` | tarball מאומת |
| `@sindresorhus/is` | `7.2.0` | tarball מאומת |
| `@speed-highlight/core` | `1.2.23` | tarball מאומת |
| `@typescript/typescript-linux-x64` | `7.0.2` | tarball מאומת |
| `blake3-wasm` | `2.1.5` | bundled בתוך tarball אחר (נבדק בזמן sync) |
| `cookie` | `1.1.1` | tarball מאומת |
| `detect-libc` | `2.1.2` | tarball מאומת |
| `error-stack-parser-es` | `1.0.5` | tarball מאומת |
| `esbuild` | `0.28.1` | tarball מאומת |
| `kleur` | `4.1.5` | tarball מאומת |
| `miniflare` | `5.20260730.0-alpha` | tarball מאומת |
| `path-to-regexp` | `6.3.0` | bundled בתוך tarball אחר (נבדק בזמן sync) |
| `pathe` | `2.0.3` | bundled בתוך tarball אחר (נבדק בזמן sync) |
| `playwright` | `1.62.1` | tarball מאומת |
| `playwright-core` | `1.62.1` | tarball מאומת |
| `semver` | `7.8.5` | tarball מאומת |
| `sharp` | `0.35.2` | tarball מאומת |
| `supports-color` | `10.2.2` | tarball מאומת |
| `tslib` | `2.8.1` | tarball מאומת |
| `typescript` | `7.0.2` | tarball מאומת |
| `undici` | `7.28.0` | tarball מאומת |
| `unenv` | `2.0.0-rc.24` | bundled בתוך tarball אחר (נבדק בזמן sync) |
| `workerd` | `1.20260730.1` | tarball מאומת |
| `wrangler` | `4.118.0` | tarball מאומת |
| `ws` | `8.21.0` | tarball מאומת |
| `youch` | `4.1.0-beta.10` | tarball מאומת |
| `youch-core` | `0.3.3` | tarball מאומת |

## פקודות תחזוקה

```bash
# לאחר npm update או שינוי lockfile, עם רשת
npm run update:offline:linux
npm run check:offline:linux

# במכונת Linux x64/glibc ללא רשת
npm run setup:npm:offline:linux
npm run check:npm:offline:linux
```

פקודת העדכון מאמתת SHA-512 וזהות package, ממחזרת קבצים קיימים, מורידה רק חסרים, בודקת את שש החבילות ה־bundled בפועל, ומייצרת manifest אטומי. מתקין האופליין מזין cache מקומי ומריץ `npm ci --offline` עם `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.
