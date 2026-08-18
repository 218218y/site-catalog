# ביקורת מראת npm אופליין — Linux x64/glibc

המסמך מתאר את פרופיל האופליין המיועד לעבודת קוד ובדיקות בסביבת הצ׳אט. מקור
האמת לגרסאות נשאר `package-lock.json`; הסקריפט מחשב מחדש את גרף התלויות בכל
הרצת עדכון ואינו מחזיק מספרי גרסאות ידניים.

## מסקנה

המראה הישנה כללה את כל 43 החבילות התואמות לפלטפורמה, אף שרוב המשקל הגיע מעץ
`wrangler` שנדרש לפריסה ולא לבדיקות בצ׳אט. לאחר בדיקה בפועל אפשר לצמצם את
המראה ל־7 חבילות בלבד:

| שימוש | חבילות |
|---|---|
| בניית frontend | `esbuild`, `@esbuild/linux-x64` |
| בדיקות טיפוסים ו־AST | `typescript`, `@typescript/typescript-linux-x64` |
| Playwright API ללא דפדפן | `@playwright/test`, `playwright`, `playwright-core` |

המשקל הכולל של tarballs ירד מ־75.95 MiB ל־17.90 MiB — חיסכון של 58.05 MiB.
Chromium ודפדפני Playwright אחרים אינם כלולים.

## מה הוסר ולמה

שורש `wrangler` מוחרג במכוון מפרופיל הצ׳אט. יחד איתו מוסר כל הגרף הטרנזיטיבי
שאינו נגיש עוד משורשי הבדיקות, ובכלל זה:

- `workerd` ו־`@cloudflare/workerd-linux-64`
- `miniflare`
- `sharp`, ‏`@img/sharp-linux-x64`, ‏`@img/sharp-libvips-linux-x64` ו־fallbacks
- חבילות Cloudflare, unenv, undici, ws, youch ותלויותיהן

החבילות האלה עדיין נשארות ב־`package.json` וב־`package-lock.json` להתקנת npm
רגילה ולפריסה. הן רק אינן נשמרות במראה המצומצמת ואינן מותקנות על ידי
`setup:npm:offline:linux`.

## בחירה אוטומטית אחרי npm update

הסקריפט מתחיל מכל התלויות הישירות של הפרויקט ומחריג רק את שורש הפריסה
`wrangler`. לאחר מכן הוא פותר מתוך lockfile את כל `dependencies`,
`optionalDependencies` ו־peer dependencies הנדרשים, ומסנן לפי Linux x64/glibc.
לכן:

- גרסאות נלקחות אוטומטית מה־lockfile.
- תלות בדיקות חדשה שתתווסף ישירות לפרויקט תיכלל אוטומטית.
- תלות טרנזיטיבית חדשה של esbuild, TypeScript או Playwright תיכלל אוטומטית.
- עץ Wrangler יישאר בחוץ עד שיוחלט במפורש שהוא נחוץ לעבודת הצ׳אט.

## קבצים נגזרים

תחת `vendor/npm/linux-x64-glibc` נוצרים:

- `manifest.json` — מלאי, גרסאות, SHA-512, שורשי הפרופיל והשורשים המוחרגים.
- `package-lock.offline.json` — lockfile מצומצם עם הפניות `file:` מקומיות.
- `package.offline.json` — package descriptor מצומצם ללא scripts של הפרויקט.

`package.json` ו־`package-lock.json` המקוריים אינם משתנים.

## טביעת אצבע סמנטית של הפרופיל

ה־manifest אינו כבול עוד ל־SHA-256 של כל `package-lock.json`. במקום זאת הוא
שומר `profileLockSha256`, שמחושב מ־projection קנוני של אותו subset בדיוק
שממנו נבנה ה־offline lock: metadata של שורש הפרויקט לאחר הסרת roots מוחרגים,
וכל package record שנגיש בפועל משורשי פרופיל הצ׳אט עבור Linux x64/glibc.

לכן שינוי ב־`wrangler` או בתלות טרנזיטיבית שלו אינו פוסל מראה שלא השתנתה
מבחינה פונקציונלית. לעומת זאת שינוי בגרסה, integrity, dependency edge או metadata
של package שנבחר לפרופיל משנה את טביעת האצבע ונחסם עד לעדכון המראה. ה־projection
משמש גם כבסיס לבניית `package-lock.offline.json`, כך שאין שני מודלים שונים של
״מה שייך לפרופיל״ שעלולים לסטות זה מזה.

בדיקת המראה משולבת גם ב־`verify_project.py`, ולכן `npm test`, `npm run verify`
ו־`npm run verify:core` מזהים mirror מיושן כחלק משערי האיכות הרגילים.

## התקנה בטוחה

המתקין יוצר פרויקט staging זמני בתוך הפרויקט, מקשר אליו את `vendor`, ומריץ בו
`npm ci --offline`. רק לאחר שההתקנה הסתיימה ועברו בדיקות runtime של esbuild,
TypeScript ו־Playwright API, הוא מחליף את `node_modules` הקיים. במקרה כשל,
ההתקנה הישנה נשארת ללא שינוי. ה־staging וה־cache הזמני נמחקים תמיד.

## אימות שבוצע

התקנה אמיתית מן המראה המצומצמת עברה ללא רשת, ולאחריה עברו:

- כל `npm run test:js`
- `npm run check:types`
- בדיקת עדכניות מלאה של בניית frontend
- transform ממשי ב־esbuild
- טעינת TypeScript 7.0.2
- טעינת Playwright API ללא הורדה או פתיחה של דפדפן

בדיקות E2E בדפדפן עדיין דורשות התקנת Chromium בנפרד. פעולות פריסה ל־Cloudflare
דורשות התקנת npm מלאה רגילה שבה Wrangler קיים.
