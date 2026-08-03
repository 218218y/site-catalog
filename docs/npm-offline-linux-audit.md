# ביקורת מראת npm אופליין — Linux x64/glibc

המסמך הוא צילום מצב של `package-lock.json` הנוכחי. מקור האמת נשאר ה־lockfile; המלאי מחושב מחדש בכל הרצת עדכון.

## ממצאים מתוקנים

- חבילות תואמות לסביבת הצ׳אט: **43**.
- חבילות עם `resolved` ו־`integrity` מלאים ב־lockfile: **37**.
- חבילות registry רגילות שבהן npm השמיט את שני השדות: **6**.
- אין חבילות bundled במלאי הזה. הסיווג הקודם של שש החבילות כ־bundled היה שגוי.
- לאחר העדכון לכל חבילה יש tarball עצמאי, רשומת SHA-512 ב־manifest והפניית `file:` ב־`package-lock.offline.json`.
- חבילות Playwright של Node כלולות; Chromium ודפדפנים אחרים אינם חלק מהמראה.
- אין בפרויקט תלות או פקודת `tsx`; אם תתווסף, היא תיכלל אוטומטית לפי ה־lockfile.

## שש החבילות שגרמו לשגיאה

עבור החבילות הבאות פקודת העדכון מריצה `npm pack` עם השם והגרסה המדויקים, מאמתת את `package/package.json` ומחשבת SHA-512:

- `@cloudflare/kv-asset-handler@0.5.0`
- `@cloudflare/unenv-preset@2.16.1`
- `blake3-wasm@2.1.5`
- `path-to-regexp@6.3.0`
- `pathe@2.0.3`
- `unenv@2.0.0-rc.24`

## כפילויות שנמצאו

- `vendor/npm/esbuild/` — 8.62 MiB לפני ניקוי.
- `vendor/npm/typescript/` — 9.57 MiB לפני ניקוי.
- ארבעת tarballs של esbuild/TypeScript בתיקיות הישנות זהים byte-for-byte לעותקים במראה הקנונית.
- `vendor/npm/esbuild/linux-arm64-*.tgz` אינו מתאים לסביבת Linux x64 של הצ׳אט.
- `.cache/npm-offline-linux/` הוא cache קבוע ישן שעלול לשכפל כמעט את כל המראה; המתקין החדש משתמש ב־cache זמני בלבד.

לאחר **עדכון מוצלח בלבד** נמחקים אוטומטית:

```text
vendor/npm/esbuild/
vendor/npm/typescript/
.cache/npm-offline-linux/
```

## משפחות קריטיות שנשמרות

| שימוש | חבילות נדרשות |
|---|---|
| בניית frontend | `esbuild`, `@esbuild/linux-x64` |
| בדיקות טיפוסים ו־AST | `typescript`, `@typescript/typescript-linux-x64` |
| Cloudflare/Wrangler | `wrangler`, `workerd`, `@cloudflare/workerd-linux-64`, `miniflare` ותלויותיהן |
| עיבוד תמונה | `sharp`, `@img/sharp-linux-x64`, `@img/sharp-libvips-linux-x64` ותלויות fallback שה־lockfile אינו מגביל לפלטפורמה |
| Playwright ללא דפדפן | `@playwright/test`, `playwright`, `playwright-core` |

## מלאי lockfile מסונן

| חבילה | גרסה | מקור metadata |
|---|---:|---|
| `@cloudflare/kv-asset-handler` | `0.5.0` | `npm pack` לפי גרסה מדויקת |
| `@cloudflare/unenv-preset` | `2.16.1` | `npm pack` לפי גרסה מדויקת |
| `@cloudflare/workerd-linux-64` | `1.20260730.1` | lockfile (`resolved` + `integrity`) |
| `@cspotcode/source-map-support` | `0.8.1` | lockfile (`resolved` + `integrity`) |
| `@emnapi/runtime` | `1.11.3` | lockfile (`resolved` + `integrity`) |
| `@esbuild/linux-x64` | `0.28.1` | lockfile (`resolved` + `integrity`) |
| `@img/colour` | `1.1.0` | lockfile (`resolved` + `integrity`) |
| `@img/sharp-libvips-linux-x64` | `1.3.1` | lockfile (`resolved` + `integrity`) |
| `@img/sharp-linux-x64` | `0.35.2` | lockfile (`resolved` + `integrity`) |
| `@img/sharp-wasm32` | `0.35.2` | lockfile (`resolved` + `integrity`) |
| `@jridgewell/resolve-uri` | `3.1.2` | lockfile (`resolved` + `integrity`) |
| `@jridgewell/sourcemap-codec` | `1.5.5` | lockfile (`resolved` + `integrity`) |
| `@jridgewell/trace-mapping` | `0.3.9` | lockfile (`resolved` + `integrity`) |
| `@playwright/test` | `1.62.1` | lockfile (`resolved` + `integrity`) |
| `@poppinss/colors` | `4.1.6` | lockfile (`resolved` + `integrity`) |
| `@poppinss/dumper` | `0.6.5` | lockfile (`resolved` + `integrity`) |
| `@poppinss/exception` | `1.2.3` | lockfile (`resolved` + `integrity`) |
| `@sindresorhus/is` | `7.2.0` | lockfile (`resolved` + `integrity`) |
| `@speed-highlight/core` | `1.2.23` | lockfile (`resolved` + `integrity`) |
| `@typescript/typescript-linux-x64` | `7.0.2` | lockfile (`resolved` + `integrity`) |
| `blake3-wasm` | `2.1.5` | `npm pack` לפי גרסה מדויקת |
| `cookie` | `1.1.1` | lockfile (`resolved` + `integrity`) |
| `detect-libc` | `2.1.2` | lockfile (`resolved` + `integrity`) |
| `error-stack-parser-es` | `1.0.5` | lockfile (`resolved` + `integrity`) |
| `esbuild` | `0.28.1` | lockfile (`resolved` + `integrity`) |
| `kleur` | `4.1.5` | lockfile (`resolved` + `integrity`) |
| `miniflare` | `5.20260730.0-alpha` | lockfile (`resolved` + `integrity`) |
| `path-to-regexp` | `6.3.0` | `npm pack` לפי גרסה מדויקת |
| `pathe` | `2.0.3` | `npm pack` לפי גרסה מדויקת |
| `playwright` | `1.62.1` | lockfile (`resolved` + `integrity`) |
| `playwright-core` | `1.62.1` | lockfile (`resolved` + `integrity`) |
| `semver` | `7.8.5` | lockfile (`resolved` + `integrity`) |
| `sharp` | `0.35.2` | lockfile (`resolved` + `integrity`) |
| `supports-color` | `10.2.2` | lockfile (`resolved` + `integrity`) |
| `tslib` | `2.8.1` | lockfile (`resolved` + `integrity`) |
| `typescript` | `7.0.2` | lockfile (`resolved` + `integrity`) |
| `undici` | `7.28.0` | lockfile (`resolved` + `integrity`) |
| `unenv` | `2.0.0-rc.24` | `npm pack` לפי גרסה מדויקת |
| `workerd` | `1.20260730.1` | lockfile (`resolved` + `integrity`) |
| `wrangler` | `4.118.0` | lockfile (`resolved` + `integrity`) |
| `ws` | `8.21.0` | lockfile (`resolved` + `integrity`) |
| `youch` | `4.1.0-beta.10` | lockfile (`resolved` + `integrity`) |
| `youch-core` | `0.3.3` | lockfile (`resolved` + `integrity`) |

## תהליך אימות

1. כל tarball נבדק מול שם וגרסה מתוך `package/package.json`.
2. חבילה עם integrity ב־lockfile נבדקת מולו לפני העתקה או הורדה.
3. חבילה שחסרים לה שדות dist מתקבלת רק מ־`npm pack <name>@<version>` ונחתמת ב־manifest.
4. `package-lock.offline.json` נבנה מחדש עם הפניות `file:` ונבדק byte-for-byte בזמן `check`.
5. ההתקנה משתמשת זמנית ב־`npm-shrinkwrap.json`, מריצה `npm ci --offline`, ומוחקת את הקובץ וה־cache הזמני גם בכשל.
6. `package-lock.json` המקורי נשאר ללא שינוי.
