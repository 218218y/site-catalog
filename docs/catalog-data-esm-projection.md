# תכנון מעבר נתוני הקטלוג והטקסונומיה ל־ESM חיצוני

## מטרת הפרוסה העתידית

Wave 1 סגר את גבול שירותי ה־runtime העסקיים: חיפוש, routes, מועדפים ו־tooltips מיוצרים כמודולי ESM חיצוניים, נבדקים יחד עם הצרכנים ומקבלים fingerprint עצמאי בפרסום.

שלושת ה־classic scripts שנותרו לפני Route module הם גבולות bootstrap/data בלבד:

- `catalog-assets.config.js` — ערכי פריסה קטנים שנכתבים עבור סביבת היעד.
- `catalogs.generated.js` — projection שנוצר מה־Compiler ומפרסם את מטא־דאטת הקטלוגים.
- `catalog-taxonomy.generated.js` — projection שנוצר מה־Compiler ומפרסם את הטקסונומיה.

הם נשארו בפרוסה הנוכחית כדי לא לערב שינוי סכמת נתונים ושינוי Compiler בתוך העברת שירותי runtime. אין להחזיר אליהם API עסקי חדש.

## יעד ארכיטקטוני

ה־Compiler יפיק שני מודולי נתונים immutable ונפרדים, לדוגמה:

```text
catalogs.generated.module.js
catalog-taxonomy.generated.module.js
```

החוזה המוצע:

```js
export const catalogs = Object.freeze(/* generated catalog records */);
export const catalogTaxonomy = Object.freeze(/* generated taxonomy */);
```

שמות הקבצים הסופיים ייקבעו בפרוסת המימוש לאחר inventory של כל צרכני כלי התחזוקה. אין להעתיק את הנתונים לתוך `app-catalog.js`, `app-favorites.js` או `app-viewer.js`.

## כללי בנייה ו־cache

1. שני מודולי הנתונים יהיו outputs חיצוניים של `tools/build_frontend_assets.py`, בדומה ל־`src/runtime`, אך מקורם יהיה ה־Compiler ולא קובץ שנערך ידנית.
2. כל Route bundle ייבא אותם ב־static import מפורש.
3. esbuild יסמן אותם `external`, כך שכל מסלול יפנה לאותו asset ולא ישכפל payload.
4. `tools/build_deploy_bundle.py` יבצע minification מתאים למודול נתונים, יחשב hash מתוכנו ויכתוב את ה־specifier הסופי לתוך Route bundles לפני fingerprinting שלהם.
5. שינוי בקוד שאינו משנה קטלוגים או taxonomy לא ישנה את hash של מודולי הנתונים. כך נשמר cache עצמאי ארוך־טווח.
6. בדיקת הבאנדל תאמת שכל Route מפנה לדור יחיד של כל projection ושאין generation ישן ולא־מקושר תחת `static/`.
7. `catalogs.search-index.json` יישאר artifact נפרד של ה־Worker. אין סיבה להכניס את אינדקס ה־OCR לגרף מודולי הדפדפן הראשי.

## מקור אמת וסכמה

- מקור האמת נשאר `catalogs.config.json`, `catalog-taxonomy.config.json` ו־`catalogs.build-state.json` דרך `tools/catalog_compiler.py`.
- ה־ESM projection וה־JSON projection יופקו מאותו model קנוני באותה הרצה.
- בדיקת reconstructability תאמת שה־ESM וה־JSON מייצגים אותו payload סמנטי ובאותו סדר דטרמיניסטי.
- טיפוסי `CatalogRecord` והטקסונומיה ייגזרו או ייבדקו מול הסכמות הקיימות; אין לתחזק ידנית חוזה שונה עבור ה־ESM.
- generated modules לא יכילו behavior, DOM access, קריאת `window` או side effects.

## מעבר ללא חלון תאימות פתוח

המעבר יבוצע בפרוסה אחת אטומית:

1. להוסיף outputs חדשים ל־Compiler ולבדיקות הדטרמיניזם.
2. להוסיף אותם כ־external data modules בגרף הבנייה והפרסום.
3. לשנות את `src/js/03-runtime-context.js` ל־imports מפורשים.
4. להסיר את `<script>` הקלאסי של שני קובצי הנתונים מכל התבניות.
5. להסיר מ־`Window` את `BARGIG_CATALOGS` ואת `BARGIG_CATALOG_TAXONOMY` לאחר הוכחת אפס consumers.
6. להסיר את קובצי ה־classic generated או להשאירם רק אם inventory של כלי חיצוני מוכיח צורך; במקרה כזה הם יסומנו compatibility-only ולא ייטענו באתר.

אין לאפשר תקופת ביניים שבה היישום בוחר בין import לבין global באמצעות fallback. fallback כזה מסתיר סטייה בין שני projections ומחזיר את בעיית החוזה החד־צדדי.

## `catalog-assets.config.js`

קובץ זה שונה מנתוני הקטלוג: הוא נכתב בזמן בניית הפריסה לפי URL ה־CDN ומדיניות delivery. ניתן להשאירו כ־classic bootstrap config קטן גם לאחר מעבר הנתונים, כל עוד:

- הוא אינו מכיל API עסקי;
- הוא נטען לפני ה־Route module;
- הערכים שלו מוכרזים ומאומתים במפורש;
- שינוי סביבת פריסה אינו מכריח בנייה מחדש של payload הקטלוגים.

מעבר שלו ל־ESM אפשרי בעתיד, אך אינו תנאי לסגירת גבול נתוני הקטלוג.

## תנאי סיום לפרוסת המימוש

- אפס קריאות runtime ל־`window.BARGIG_CATALOGS` ול־`window.BARGIG_CATALOG_TAXONOMY`.
- אפס `<script>` קלאסי עבור catalog data ו־taxonomy במסמכי האתר.
- הנתונים אינם משוכפלים בתוך Route bundles.
- לכל projection יש asset fingerprinted יחיד ונפרד.
- שינוי Route code בלבד אינו משנה את hash של נתוני הקטלוג.
- JSON, ESM, SEO, Search Worker וכלי התחזוקה עוברים בדיקת parity מאותו model קנוני.
- אין fallback כפול, bridge global או alias ציבורי חדש.
