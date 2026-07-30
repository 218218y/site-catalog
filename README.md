# אתר קטלוגים — Cloudflare Pages + Cloudflare R2

הפרויקט מוגדר למסלול עבודה אחד וברור:

- האתר נבנה כאתר סטטי מלא עם כתובות נקיות. תיקיית המקור אינה משמשת כשרת; preview מקומי נוצר ב־`dist/site-local` ובאנדל הפריסה ב־`dist/site-upload-r2`.
- לכל קטלוג ולכל עמוד שיתוף נוצר קובץ HTML בכתובת נקייה, אך כולם משתמשים באותן תבניות ובאותו JavaScript משותף; אין תחזוקת HTML ידנית לכל קטלוג.
- `site.template.html` ו-`legal.template.html` הם מקורות ה-HTML המשותפים, ו-`tools/build_site_pages.py` מייצר מהם את ששת הדפים הציבוריים.
- `partials/site-footer.html` שומר את מבנה ועיצוב הפוטר, ו-`partials/site-footer.content.json` שומר רק את הטקסטים והפרטים הניתנים לעריכה.
- קוד המקור של הממשק מחולק לפי תחומים תחת `src/js`, שירותי ESM חיצוניים תחת `src/runtime` ו־CSS תחת `src/css`; שלושה entrypoints נבנים ל־ES Modules נפרדים לפי מסלול, וכל מסלול מוריד רק את קוד ה־Features הדרוש לו.
- `src/runtime/site-routes.js` מרכז את בניית הכתובות ופענוחן; תוצר `site-routes.js` נשאר asset נפרד ומיובא במפורש כדי לשמור cache משותף בין המסלולים.
- האתר הסטטי עצמו עולה ל-Cloudflare Pages דרך Wrangler.
- תמונות עמודי הקטלוגים נשמרות ומוגשות דרך Cloudflare R2 / CDN.
- תיקיית `assets/pages` נשארת תיקיית עבודה מקומית וסנכרון ל-R2; היא לא מועתקת לתיקיית ההעלאה ל-Cloudflare Pages.

## מבנה דפי האתר

```text
/                                      רשימת הקטלוגים
/category/<category>/                  עמוד קטגוריה
/category/<category>/<subcategory>/   עמוד תת־קטגוריה
/catalog/<catalog-id>/                 גלריית עמודי קטלוג
/catalog/<catalog-id>/page/<number>/   צפייה ושיתוף של עמוד מדויק
favorites.html                         המועדפים כדף עצמאי
terms.html                             תנאי שימוש
privacy.html                           מדיניות פרטיות
accessibility.html                     הצהרת נגישות
```

לא עורכים ידנית את קובצי ה־HTML שנוצרו. עורכים את התבניות והחלקים המשותפים, ואז מריצים בנייה אחת:

```bat
.01-bundle-site-r2.bat
```

הפקודה בונה, רק כאשר נדרש, את `dist/site-upload-r2` ומעתיקה מאותו תוצר מאומת את `dist/site-local`. לפני הבנייה היא דורשת הוכחה מקומית שהמהדורה הנוכחית של `catalogs.generated.json` השלימה סנכרון R2 דרך `.07-sync-r2-images.bat`; כך אי אפשר לייצר בטעות אתר שמפרסם כתובות cache חדשות לפני שהתמונות קיימות. אין צורך להריץ סנכרון מחדש עבור שינויי JavaScript, CSS, HTML, טקסט, SEO או עיצוב בלבד — מצב הסנכרון הקיים נשאר תקף כל עוד לא השתנו קובצי התמונות או המטא־דאטה שנוצר עבורם. `.05-start-server.bat` מגיש מיד את `dist/site-local` הקיים ואינו בודק או בונה. לבדיקת עדכניות עם אפשרות לבנייה משתמשים במפורש ב־`.03-check-and-start-server.bat`. תיקיית המקור נשארת נקייה ואינה משמשת כ־web root. קובצי ה־shell הטכניים `catalog.html` ו־`viewer.html` נשארים רק במקור לצורכי בדיקות ותבניות ואינם נכללים באתר המלא.


## מבנה קוד הממשק

קובצי `app-catalog.js`, `app-favorites.js`, `app-viewer.js` וקובצי `styles-*.css` נוצרים אוטומטית. קובצי ה־JavaScript נטענים בדפדפן כ־`type="module"`; אין loader תאימות ואין לערוך את התוצרים ישירות.

מקורות JavaScript נמצאים תחת `src/js` ומחולקים לפי בעלות על state, DOM ו־lifecycle. הבית והקטלוג אינם מורידים את קוד או state ה־Viewer; דף המועדפים מוסיף את סביבת העבודה שלו; ודף ה־Viewer כולל במכוון גם Search, Catalog Grid ו־Favorites Workspace כדי לאפשר ניווט בתוך אותו document בזמן fullscreen. תקשורת בין Features עוברת דרך Interfaces קפואים ומפורשים, ו־`90-bootstrap.js` נשאר composition root בלבד. מקורות CSS נשארים שכבות תחומיות, אך נבנים לשלושה stylesheets לפי מסלול כדי לא לטעון Viewer או Workspace במקום שאינם קיימים.

לבנייה ידנית של קובצי הממשק בלבד:

```bat
python tools\build_frontend_assets.py
```

לבדיקה שקובצי הבאנדל מעודכנים בלי לשנות דבר:

```bat
python tools\build_frontend_assets.py --check
```

`build_site_pages.py` ובניית הבאנדל מריצים את בניית הממשק אוטומטית. השרת המקומי מגיש את הבאנדל המלא מתוך `dist/site-local`, ולכן הוא בודק את אותו מבנה כתובות כמו הפריסה; הבנייה מתבצעת רק לאחר בדיקת עדכניות ורק אם נבחר לעדכן. תיקיות `src/js` ו־`src/css` נשארות בפרויקט העבודה ואינן מועלות לאתר; בפריסה נשלחים רק קובצי ה־Route שנבנו והוחתמו ב־hash. כל חבילת JavaScript היא ES Module דפדפן אמיתי, ולכן היא פועלת אוטומטית ב־strict mode ופונקציות המימוש אינן דולפות ל־`window`. כלי הבנייה מאמת שמות, סדר וכפילויות במניפסט, וחוזי ה־CI מוודאים שהחבילה אינה מכילה Feature אסור או סמל runtime שאינו קיים בה.

בבאנדל הפריסה כל דף HTML מפנה לשמות קבצים עם hash תוכן. לכן שינוי ב־JavaScript או ב־CSS מחייב לעדכן את ההפניות בכל דפי הקטלוג והשיתוף, גם אם תוכן הקטלוגים עצמם לא השתנה. כלי הבנייה מחשב כעת את שמות ה־hash לפני רינדור הדפים וכותב כל דף פעם אחת בלבד; הוא אינו יוצר תחילה מאות דפים ואז פותח וכותב את כולם מחדש. בסיום מודפסת שורת `[timing]` שמפרידה בין הכנת נכסים, רינדור דפים, אימות/חתימה והעתקת ה־preview, כדי לזהות פקק מקומי אמיתי בלי לנחש.

מפת האחריות, כיוון התלויות וכללי התחזוקה מפורטים ב־`docs/frontend-architecture.md`.



## סביבת העבודה של המועדפים

דף המועדפים תומך בהערות פרטיות לכל דגם, סינון לפי קטלוג, שינוי סדר בגרירה או בכפתורי מעלה/מטה, בחירה ממוקדת, שיתוף רשימה ובירור מרוכז דרך Gmail. כברירת מחדל פעולות השיתוף והבירור כוללות את כל המועדפים שמוצגים לפי המסנן; כאשר מסומנים פריטים, הן כוללות רק את הבחירה. ההערות והסדר נשמרים ב־`localStorage` במכשיר בלבד. קישור רשימת המועדפים ממשיך להכיל רק מזהי קטלוגים ועמודים — ללא הערות וללא הסדר המקומי; הודעת שיתוף או בירור מרוכז כוללת הערות רק כאשר המשתמש מפעיל אותה במפורש.

## עדכון קטלוגים ועמודי SEO

לאחר הוספה, שינוי או מחיקה של קטלוג יש לעדכן/להמיר את נתוני הקטלוג כרגיל.
ההרצה הבאה של `.01-bundle-site-r2.bat` או `npm run build:local`
מייצרת מחדש אוטומטית את עמודי הקטלוג, עמודי השיתוף, עמודי הקטגוריות וה־sitemap.
תוצר קודם נמחק באופן מלא, ולכן כתובת של קטלוג שנמחק או שונה אינה נשארת בטעות.

קטלוג חדש שמשויך לקטגוריה קיימת נבנה אוטומטית, אך לפני הפצה ציבורית יש
לעדכן במפורש את `seo-routes.lock.json`. הנעילה מונעת שינוי שקט של `id` או slug
שכבר הפכו לכתובת ציבורית. בדיקה ועדכון מכוון:

```bat
npm run check:seo-routes
npm run seo:routes:update -- --confirm-route-lock-update
```

כאשר מזינים בלוח
השליטה קטגוריה או תת־קטגוריה חדשה, היא מתווספת אוטומטית לעורך הטקסונומיה.
השם נלקח מהקטלוג, ואילו slug ותיאור נשארים מסומנים כחסרים עד להשלמתם.
המערכת אינה מנחשת טקסט שיווקי או כתובת. כל עוד חסרים שדות, יצירת באנדל
והעלאה נחסמות בהודעה ברורה. קטגוריה ללא קטלוגים מושמטת אוטומטית מהאתר,
אך נשמרת בעורך עד שמוחקים אותה במפורש.

## תיקיות `dist`

בזרימת העבודה קיימים שני תוצרי עבודה פרטיים ותוצר ציבורי שמור ונפרד:

```text
dist/site-upload-r2   התוצר המאומת שמועלה ל־Cloudflare Pages
dist/site-local       עותק זהה שמוגש על ידי .05-start-server.bat
dist/site-public-preview   מועמד public מאומת; אינו נפרס אוטומטית
.03-check-and-start-server.bat   בדיקת עדכניות אופציונלית לפני הפעלת השרת
```

לצדן נשמרים קובצי `*.build.json` עם חתימות המקורות ומלאי הקבצים. הם נמצאים מחוץ לתיקיות האתר ואינם מועלים. לתוצר הציבורי נשמר גם `site-public-preview.audit.json`, הקושר תוצאת ביקורת מוצלחת לתוכן המדויק של התוצר ולקוד כלי הביקורת. בדיקות Playwright משתמשות באותו `dist/site-local`: לפני פתיחת שרת הבדיקות מתבצעת בדיקת חתימה, ורק אם המקורות השתנו התוצר המקומי נבנה מחדש. כך אין תיקיית `dist/site-e2e`. התיקיות הישנות `dist/seo-private`, `dist/seo-public` ו־`dist/site-e2e` אינן בשימוש ומנוקות בבנייה הרגילה.

## מה מעלים ל-Cloudflare Pages

אחרי יצירת הבאנדל מעלים ל-Cloudflare Pages את תיקיית הבאנדל:

```bat
dist\site-upload-r2
```

התיקייה כוללת את קבצי האתר, קבצי הנתונים וההגדרה `catalog-assets.config.js` שמפנה את התמונות לכתובת ה-CDN:

```text
https://cdn.bargig-furniture.com/assets/pages/...
```

## לוח שליטה מקומי בדפדפן

לרוב העבודה היומיומית עדיף לפתוח את לוח השליטה:

```bat
.04-catalog-control-panel.bat
```

הלוח נפתח דרך שרת מקומי בכתובת `127.0.0.1:8765`. חשוב לפתוח אותו רק דרך `.04-catalog-control-panel.bat`, כי השרת הזה מספק את כתובות ה-API שהכפתורים צריכים. פתיחה של `catalog-control-panel.html` דרך שרת האתר הרגיל תציג דף, אבל הפעולות לא יעבדו. JavaScript ו-CSS של הלוח נמצאים ב-`src/control-panel`, נבדקים ב-TypeScript strict, והשרת מגיש רק את שלושת קובצי הממשק המורשים עם CSP וללא קוד inline.

דרך לוח השליטה אפשר:

- להוסיף PDFים חסרים לרשימת הקטלוגים.
- לערוך כותרת, תיאור, קטגוריה, תת־קטגוריה והגדרת OCR.
- לנהל את `catalog-taxonomy.config.json` דרך אזור ייעודי: שמות, slugs, תיאורים וסדר של קטגוריות ותתי־קטגוריות. קטגוריות חדשות מזוהות אוטומטית מתוך רשימת הקטלוגים.
- לשנות שם קטגוריה או תת־קטגוריה ולעדכן יחד את כל הקטלוגים שמפנים אליה.
- לערוך את כל טקסטי הפוטר בלי לגעת ב-HTML או ב-CSS; מספרי טלפון ומייל מעדכנים גם את הקישורים המתאימים.
- לשנות `id` בצורה מבוקרת, כולל שינוי תיקיית התמונות המתאימה ועדכון הגדרות חיפוש לפי עמודים.
- להריץ המרות, ניקוי קטלוגים לא רשומים ורענון OCR/חיפוש.
- לבדוק סנכרון R2 בלי שינוי אמיתי.
- לבצע סנכרון R2 בפועל.
- ליצור באנדל R2 נקי ולהעלות אותו ל-Cloudflare Pages.

הלוח הוא כלי עבודה מקומי בלבד ולא מיועד לעלות לאתר.

## סדר עבודה מומלץ

### 1. התקנה מקומית ראשונה

```bat
.20-setup-windows.bat
```

### 2. הוספת PDFים חדשים לרשימה

העתק קבצי PDF חדשים אל:

```bat
assets\pdfs
```

ואז הרץ:

```bat
sync-catalog-pdfs.bat
```

הפקודה מוסיפה ל-`catalogs.config.json` רק PDFים שלא רשומים עדיין. היא לא ממירה תמונות ולא מריצה OCR.

### 3. עריכת פרטי קטלוגים

אפשר לערוך דרך לוח השליטה או ידנית בקובץ:

```bat
catalogs.config.json
```

שדות חשובים:

```json
{
  "id": "catalog-id",
  "title": "שם הקטלוג",
  "description": "תיאור קצר",
  "category": "קטגוריה ראשית",
  "subcategory": "תת קטגוריה",
  "ocr": true
}
```

אם קטלוג מסוים לא צריך OCR, או שה-OCR גורם לזיהויים שגויים, אפשר להגדיר:

```json
"ocr": false
```

ברירת המחדל היא `true`. אחרי כיבוי OCR לקטלוג מסוים מריצים את ההמרה הרגילה; אין צורך בפקודת המרה גלובלית בלי OCR.

### 4. המרת PDFים לתמונות ולאינדקס חיפוש

```bat
.10-convert-catalogs.bat
```

הפקודה יוצרת/מעדכנת:

```bat
assets\pages
catalogs.build-state.json
catalogs.generated.js
catalogs.generated.json
catalogs.search.js
catalogs.search.json
catalogs.search-index.json
```

`catalogs.config.json` הוא מקור האמת למידע העריכתי, ו־`catalogs.build-state.json`
הוא מקור האמת היחיד לנתונים שנגזרו מה־PDF. קובצי `generated/search` והאינדקס המנורמל נוצרים
רק דרך `tools/catalog_compiler.py`; אין לערוך אותם ידנית. פירוט מלא נמצא ב־
`docs/catalog-data-compiler.md`.

אם כבר קיימות תמונות תקינות, הסקריפט מדלג עליהן ולא מרנדר מחדש בלי צורך. אם אינדקס החיפוש חסר או שצריך OCR מעודכן, הוא מרענן את החיפוש ככל האפשר בלי לגעת בתמונות קיימות.

#### ניקוי OCR לפני כתיבה לאינדקס

ה־OCR אינו נכתב יותר לאינדקס כטקסט גולמי. צינור החיפוש משתמש בפלט TSV של Tesseract ובונה ממנו טקסט שמרני בלבד:

- ריצה במנוע LSTM (`--oem 1`).
- זיהוי עמוד מלא במצב sparse text (`--psm 11`) במקום הנחה שכל העמוד הוא בלוק טקסט אחיד.
- סף אמינות נפרד לעמוד מלא ולחיתוכי הכותרת הממוקדים.
- סינון סימנים, אותיות בודדות, ערבוב עברית/לטינית בתוך מילה, אותיות סופיות במקום בלתי אפשרי ורצפים חוזרים חשודים.
- בדיקת איכות ברמת שורה, איחוד שורות כפולות ותקרת בטיחות למספר המילים שנכנסות מכל עמוד.
- טקסט מוטמע תקין מתוך ה־PDF ו־`catalogs.search-overrides.json` נשמרים בנפרד ואינם עוברים את הסינון האגרסיבי של OCR.

ברירות המחדל השמרניות הן:

```bat
--ocr-min-confidence 65
--ocr-title-min-confidence 45
--ocr-max-words-per-page 180
```

אם חסרה מילה אמיתית, עדיף להוסיף אותה ל־`catalogs.search-overrides.json` ולא להוריד מיד את סף האמינות לכל הקטלוגים. למי שמעדיף דיוק נוסף על פני זמן ריצה אפשר להתקין את קובצי השפה `heb` ו־`eng` מתוך `tessdata_best`; הקוד כבר מכריח שימוש במנוע LSTM התואם להם.

בכל הרצה מתבצע גם ניקוי עקבי:

- קטלוג שהוסר מתוך `catalogs.config.json` נמחק מתוך `assets/pages` ומאינדקס החיפוש שנוצר.
- קטלוג שעדיין רשום אבל קובץ ה־PDF שלו חסר עוצר את ההמרה בלי למחוק דבר. הסרה מתבצעת רק לאחר אישור מפורש בלוח השליטה או בהרצה מאושרת עם `--prune-missing-pdfs`.
- קובצי PDF קיימים לעולם אינם נמחקים על ידי פקודת ההמרה.

אפשרויות תחזוקה נוספות:

```bat
.011-convert-catalogs-force.bat
.012-refresh-ocr-search.bat
```

`.011-convert-catalogs-force.bat` משתמש בפרופיל `force` ומרנדר מחדש בהכרח את כל קובצי ה־PDF התקינים. `.012-refresh-ocr-search.bat` משתמש בפרופיל `ocr-refresh` ושומר תמונות קיימות ככל האפשר. שלושת מסלולי ההמרה ולוח השליטה בוחרים פרופיל קנוני מתוך `tools/catalog_conversion_profiles.py`, כך שאין רשימות דגלים כפולות בין ה-BAT, ה-CLI והשרת.

### 5. בדיקת סנכרון R2 לפני שינוי אמיתי

```bat
.06-sync-r2-images-preview.bat
```

הפקודה מציגה מה יועלה, מה יימחק ומה כבר זהה ב-R2. היא לא משנה כלום ב-bucket.

### 6. סנכרון תמונות ל-Cloudflare R2

```bat
.07-sync-r2-images.bat
```

הסנכרון:

- מעלה תמונות חדשות.
- מעלה מחדש רק תמונות שהשתנו.
- מוחק מה-R2 קבצים שנמצאים תחת `assets/pages/` ב-bucket אבל כבר לא קיימים מקומית.
- רק לאחר שכל הפעולות הצליחו כותב את `.r2-catalog-sync-state.json`, קובץ מצב מקומי ומוחרג מ־Git שמקשר בין מהדורת המטא־דאטה הנוכחית לבין הסנכרון שהושלם.

מריצים את הסנכרון רק לאחר המרה, הוספה, החלפה או מחיקה של תמונות/קטלוגים, או לאחר שינוי הגדרות ההמרה שמייצר מהדורת תמונות חדשה. לפני העלאת אתר שכל השינויים בו הם בקוד או בתוכן האתר, מדלגים על `.07` ומריצים ישירות `.01` ואז `.02`; שתי הפקודות בודקות אוטומטית שמצב התמונות הקודם עדיין תקף.

אם רוצים לסנכרן בלי מחיקות:

```bat
.07-sync-r2-images.bat --no-delete
```

אם רוצים פירוט מלא בתצוגה המקדימה:

```bat
.06-sync-r2-images-preview.bat --show-all
```

### 7. יצירת באנדל R2 ל-Cloudflare Pages

```bat
.01-bundle-site-r2.bat
```

תוצאה:

```bat
dist\site-upload-r2   תיקיית ההעלאה
dist\site-local       עותק זהה לצפייה מקומית
```

אם מקורות האתר והגדרות הבנייה לא השתנו, הפקודה מאמתת את התוצר הקיים ומדלגת על בניית מאות עמודי SEO. התיקיות הישנות `dist\seo-private` ו־`dist\seo-public` מוסרות אוטומטית. את `dist\site-upload-r2` מעלים ל-Cloudflare Pages. הבאנדל לא מעתיק את `assets/pages`; התמונות נטענות מ-R2 דרך:

```text
https://cdn.bargig-furniture.com/assets/pages/...
```

אם צריך כתובת CDN אחרת:

```bat
.01-bundle-site-r2.bat --external-assets-url https://cdn.example.com
```

אם רוצים גם ZIP של תיקיית ההעלאה:

```bat
.01-bundle-site-r2.bat --zip
```

זה ייצור בנוסף:

```bat
dist\site-upload-r2.zip
```

### 8. העלאת הבאנדל ל-Cloudflare Pages

לאחר בנייה מריצים:

```bat
.02-bundle-site-r2-upload cloudflare.bat
```

כלי ההעלאה אינו בונה מחדש. לפני העלאת Pages הוא בודק שהמהדורה הנוכחית אכן סונכרנה ל־R2, ואז בודק דרך הדומיין הציבורי את הכתובות המדויקות שהדפדפן יבקש — כולל פרמטרי הגרסה של השכבות הפעילות. במצב `responsive` נבדקות Full, Medium ו־Thumbnail; במצב `full-only` נבדקות Full ו־Thumbnail בלבד, משום שהאתר אינו מפנה כלל ל־Medium. בדיקה זו תופסת גם 404 ישן שנשמר ב־CDN לכתובת גרסה מסוימת. לאחר מכן הוא בודק ש־`dist\site-upload-r2` קיים, שכל הקבצים תואמים למלאי שנרשם בבנייה, שה־hash של נכסי CSS/JS תקין ושמקורות האתר לא השתנו מאז הבנייה. אם משהו השתנה הוא נעצר ומבקש להריץ קודם `.01-bundle-site-r2.bat`; רק תוצר מאומת מועלה ל־Pages. הכלי משנה רק את אתר ה־Pages ואינו קורא או מעדכן את הגדרות ה־CORS של R2.

### בחירת שכבת התמונות בצופה

הקובץ `catalog-assets.config.js` כולל מתג יחיד:

```js
window.BARGIG_CATALOG_IMAGE_DELIVERY_MODE = "full-only";
```

- `"full-only"` — הצופה ותצוגות מקדימות גדולות אינם מבקשים כלל את תיקיית `medium`; כרטיסים ותמונות זעירות ממשיכים להשתמש ב־thumbnail, ובמקרה כשל בצופה thumbnail נשאר fallback חירום.
- `"responsive"` — מחזיר את הבחירה האוטומטית בין Medium ל־Full לפי גודל התצוגה, צפיפות הפיקסלים והזום.

הבאנדל שומר את הערך שנבחר ומחליף רק את כתובת ה־CDN. במצב `full-only` מספר השכנים הנטענים מראש מצטמצם לאחד מכל צד, כדי לא לחמם ארבע תמונות Full כבדות ברקע.

העלאת production מתבצעת בלי `--branch`. ב־Cloudflare Pages הפרמטר `--branch` מיועד לפריסת preview; לכן הכלי משתמש בו רק כאשר מעבירים במפורש `--preview-branch NAME`.

אחרי ש־Wrangler מדווח שההעלאה הסתיימה בהצלחה, כלי ההעלאה מסיים מיד ואינו פונה לאתר הציבורי ואינו משווה את ה־HTML או את רשימת קובצי ה־CSS/JS מול הדומיין. כך תוספות שמוזרקות בדרך על ידי סינון, Proxy או שירות צד שלישי אינן הופכות העלאה תקינה לשגיאה. בדיקות השלמות המקומיות של הבאנדל עדיין מתבצעות תמיד לפני ההעלאה: כל קובץ CSS/JS שה־HTML מפנה אליו חייב להתקיים, להיות תחת `static`, ולהכיל בשם את ה־hash התואם לתוכן; דורות ישנים שאינם בשימוש נדחים.

הקובץ העליון `404.html` ומדיניות ה־cache שב־`_headers` נשארו בבאנדל עצמו, אך כלי ההעלאה אינו בודק אותם דרך הרשת לאחר הפריסה.

ב־Caching > Configuration יש להשאיר את **Browser Cache TTL** על **Respect Existing Headers**. תמונות מקומיות תחת `/assets/pages/*` וקובצי `static` בעלי hash נשמרים לשנה עם `immutable`; התמונות החיות שמגיעות מ־R2/CDN ממשיכות להשתמש במדיניות ה־cache של אותו שירות ואינן מושפעות מ־`_headers` של Pages.

```bat
python tools\build_deploy_bundle.py --out dist\site-upload-r2 --external-assets-url https://cdn.bargig-furniture.com
node_modules\.bin\wrangler.cmd pages deploy "dist\site-upload-r2" --project-name bargig-catlog
```

לפריסת preview בלבד:

```bat
python tools\deploy_cloudflare_pages.py --preview-branch test-name
```

ה־CORS הוא הגדרה חד־פעמית/תחזוקתית נפרדת. רק כאשר צריך לשנות אותה במפורש, מריצים:

```bat
configure-r2-cors.bat
```

הפרמטר `--build-first` נשאר כאפשרות מפורשת למי שרוצה פעולה משולבת, אך קובץ ההעלאה הרגיל אינו משתמש בו. ברירת המחדל היא אימות והעלאה בלבד.

אותה בנייה והעלאה זמינה גם בלוח השליטה בכפתור “העלאת באנדל ל-Cloudflare”.

## הגדרת R2

בפעם הראשונה צור קובץ פרטי בשם `r2.env` לפי הדוגמה:

```bat
copy r2.env.example r2.env
```

ומלא בו:

```text
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=bargig-catalog
R2_PREFIX=assets/pages
R2_PUBLIC_URL=https://cdn.bargig-furniture.com
```

`r2.env` מכיל מפתחות גישה. לא מעלים אותו ל-Cloudflare Pages ולא ל-GitHub.

## בדיקת תקינות לפני העלאה

אחרי `.01-bundle-site-r2.bat`, בדוק שקיימים:

```bat
dist\site-upload-r2\index.html
dist\site-upload-r2\_headers
dist\site-upload-r2\static\*.js
dist\site-upload-r2\static\*.css
```

קבצי ה־CSS/JS בבאנדל ההעלאה מקבלים שם עם hash לפי תוכן, לדוגמה
`static\app.abc123def456.js`. לכן אחרי עדכון אתר הדפדפן מבקש URL חדש ולא נתקע על
`app-catalog.js`, `app-favorites.js` או `app-viewer.js` ישן מה־cache. כתובת ה־CDN של R2 נכתבת לתוך קובץ ההגדרה לפני ה־hash,
ולכן גם שינוי כתובת CDN מקבל שם קובץ חדש בבאנדל.

בתיקיית ההעלאה לא אמורה להיות תיקיית:

```bat
assets\pages
```

אם התמונות לא מופיעות באתר אחרי העלאה, בדוק קודם את חמשת הדברים האלה:

1. `.07-sync-r2-images.bat` הסתיים בלי שגיאה וכתב מצב סנכרון עדכני.
2. הרצת `.01-bundle-site-r2.bat` רק אחרי הסנכרון.
3. הקבצים קיימים ב-R2 תחת הנתיב `assets/pages/...`.
4. `.02-bundle-site-r2-upload cloudflare.bat` עבר את בדיקת הכתובות המדויקות המכילות את פרמטרי הגרסה בלי 404.
5. אם זו הקמה ראשונית או ששינית את המדיניות, `configure-r2-cors.bat` הסתיים בהצלחה.

## קבצים חשובים בפרויקט

```text
index.html                         דף האתר הראשי
src/css/                           מקורות העיצוב לפי תחומים; נערכים ידנית
src/js/                            מקורות JavaScript לפי תחומים; נערכים ידנית
src/runtime/                       שירותי ESM טיפוסיים וחיצוניים המשותפים למסלולים
styles.css                         באנדל CSS שנוצר אוטומטית מכל src/css
app-catalog.js                    ES Module שנוצר למסלולי הבית והקטלוג
app-favorites.js                  ES Module שנוצר למסלול המועדפים
app-viewer.js                     ES Module שנוצר למסלול ה־Viewer
tools/build_frontend_assets.py    בנייה אטומית ובדיקת עדכניות של תוצרי הממשק
catalog-search.js                  תוצר ESM חיצוני ומפוענח של לקוח החיפוש; המקור תחת src/runtime
catalog-search-worker.js           מנוע החיפוש שרץ מחוץ ל־Main Thread
catalogs.search-index.json         אינדקס הפוך ומנורמל שנבנה מראש בזמן Build
catalog-snapshot.js                מקור ESM לצילום עמוד; מיובא רק מ־Viewer ואינו נפרס כקובץ עצמאי
catalog-assets.config.js           כתובת בסיס התמונות ומדיניות responsive/full-only; בבאנדל R2 מוחלף רק URL ה-CDN
social-share-default.png            תמונת ברירת המחדל לשיתוף קישור ותגיות Open Graph/Twitter (1200×630)
catalogs.config.json               רשימת הקטלוגים לעריכה
catalogs.build-state.json          מצב ההמרה הסמכותי: עמודים, גרסאות תמונה, מידות וטקסט חיפוש
schemas/                           חוזי JSON Schema רשמיים למקורות ולתוצרי הקטלוג
tools/catalog_compiler.py          Compiler יחיד ודטרמיניסטי לכל נתוני הקטלוג והחיפוש הנגזרים
tools/catalog_schema.py            אימות Schema ואילוצים חוצי־קבצים ללא תלות חיצונית נוספת
partials/site-footer.html          תבנית מבנה הפוטר; העיצוב והתגיות נשארים קבועים
partials/site-footer.content.json  טקסטי הפוטר הנערכים דרך לוח השליטה
tools/footer_content.py            אימות, escaping ובניית קישורי הפוטר מתוך קובץ התוכן
catalogs.generated.js              נתוני קטלוגים שנוצרו אוטומטית
catalogs.search.js                 תוצר חיפוש תאימות שנוצר אוטומטית; אינו נטען באתר
catalogs.search-index.json         אינדקס החיפוש הפעיל והדטרמיניסטי עבור ה־Worker
.04-catalog-control-panel.bat          פתיחת לוח השליטה המקומי
catalog-control-panel.html         מעטפת HTML דקה של לוח השליטה המקומי
src/control-panel/                 JavaScript ו-CSS של לוח השליטה; נכללים ב-TypeScript strict
types/control-panel-api.d.ts       חוזי DTO של לוח השליטה בצד הדפדפן
.02-bundle-site-r2-upload cloudflare.bat      העלאת dist/site-upload-r2 ל-Cloudflare Pages בלבד
configure-r2-cors.bat               החלה ואימות של מדיניות CORS בלבד
r2-cors.json                        מדיניות קריאת GET/HEAD מהדפדפן עבור bucket התמונות הציבורי
tools/catalog_control_server.py    שרת מקומי מוקשח שמפעיל פעולות קבועות ומחזיר state קנוני
tools/catalog_control_api.py       גבול HTTP/DTO, מגבלות גוף בקשה ואימות payload
tools/catalog_conversion_profiles.py מקור אמת יחיד לפרופילי production/force/ocr-refresh
assets/pages                       תמונות מקומיות לסנכרון אל R2; לא מועתקות לבאנדל ההעלאה
assets/pdfs                        קבצי PDF מקוריים; נשארים בפרויקט העבודה
.01-bundle-site-r2.bat                 יצירת תיקיית העלאה נקייה ל-Cloudflare Pages עם תמונות מ-R2
.06-sync-r2-images-preview.bat         בדיקת תכנון סנכרון R2 בלי שינוי אמיתי
.07-sync-r2-images.bat                 סנכרון R2 בפועל
r2.env.example                     תבנית להגדרת Cloudflare R2 מקומית
tools/build_deploy_bundle.py       בניית תיקיית ההעלאה ל-Cloudflare Pages במסלול R2 בלבד
tools/deploy_cloudflare_pages.py  העלאה קבועה ל-Cloudflare Pages דרך Wrangler; CORS רק במצב תחזוקה מפורש
tools/sync_r2_catalog_images.py    כלי הסנכרון מול Cloudflare R2 ללא תלות ב-AWS CLI
sync-catalog-pdfs.bat              סריקת assets/pdfs והוספת PDFים חסרים לרשימה
.10-convert-catalogs.bat               המרת PDF חדשים/שהשתנו; PDF חסר עוצר בלי מחיקה
.011-convert-catalogs-force.bat         המרה מחדש של כל ה-PDFים התקינים; PDF חסר עוצר בלי מחיקה
.012-refresh-ocr-search.bat             רענון אינדקס חיפוש/OCR בלי רינדור תמונות מחדש ככל האפשר
```

## הפעלה מקומית

לאתר הראשי בלבד:

```bat
.05-start-server.bat
```

או:

```bat
npm run serve
```

לוח השליטה לא עובד דרך השרת של האתר הראשי. בשביל לוח השליטה משתמשים ב:

```bat
.04-catalog-control-panel.bat
```

## פקודות בנייה ובדיקה אחידות

הפרויקט משתמש כעת ב־`package.json` גם כתהליך עבודה אחיד וגם להרצת בדיקות דפדפן אמיתיות. אחרי קבלת הפרויקט במחשב חדש מריצים פעם אחת:

```bat
npm ci
npm run setup
```

`npm run setup` מכין את סביבת Python המקומית `.venv` ומתקין את Chromium המבודד של Playwright. אפשר במקום זאת להריץ את `.20-setup-windows.bat`, שמבצע את כל השלבים האלה ברצף.
גרסאות חבילות Python נעולות במפורש ב־`tools/requirements*.txt`, ו־Wrangler מותקן כתלות מקומית נעולה של הפרויקט. כלי ההעלאה אינו משתמש ב־Wrangler גלובלי או בגרסת `npx` צפה; לאחר שינוי lockfiles יש להריץ `npm ci` ו־`npm run setup:python`. גרסת Node המומלצת ל־CI ולפיתוח נשמרת ב־`.nvmrc`.

### סביבת esbuild מקומית ללא התקנת npm מלאה

לבדיקת קוד, עבודה בצ'אט ובניית קובצי ה־frontend אין צורך להתקין Playwright, Wrangler ושאר עץ התלויות. הפרויקט כולל ארכיונים נעולים תחת `vendor/npm/esbuild` ומתקין מהם רק את `esbuild` ואת הבינארי המתאים למערכת:

```bash
python tools/bootstrap_esbuild_offline.py
python tools/build_frontend_assets.py --check
```

המנגנון תומך ב־Linux x64, Linux ARM64 ו־Windows x64, מאמת את חתימות SHA-512 מה־lockfile ואינו פונה לרשת או מפעיל `npm`. כלי בניית ה־frontend מפעיל את ה־bootstrap הזה אוטומטית כאשר `esbuild` חסר. אפשר לבדוק התקנה קיימת ללא שינוי באמצעות:

```bash
python tools/bootstrap_esbuild_offline.py --check
```

ההתקנה המלאה באמצעות `npm ci` עדיין נדרשת לעבודות שבאמת משתמשות ב־TypeScript, Wrangler, Playwright או במסלול האימות המלא.

גרסאות npm חדשות חוסמות install scripts של תלויות שלא נבדקו. `package.json` מאשר במפורש רק את `esbuild`, `sharp` ו־`workerd`; הגרסאות המדויקות שלהן עדיין נעולות ב־`package-lock.json`. בסוף `npm ci` רץ `tools/check_node_install_scripts.js`, שמפעיל בפועל את הבינאריים ואת Wrangler ונכשל בהודעה ברורה אם סקריפט נדרש נחסם או התקנה בינארית נפגמה. אין לאשר חבילות נוספות אוטומטית בלי לבדוק מדוע הן מבקשות install script.

הפקודות המרכזיות:

```bat
npm run build          rem בניית מודולי המסלולים, קובצי CSS וכל דפי HTML
npm run test:js        rem בדיקות JavaScript, תחביר ודפים שנוצרו
npm run test:python    rem בדיקות Python מתוך .venv
npm run test:e2e       rem מסלולי שימוש אמיתיים בדפדפן Chromium
npm test               rem בדיקה מהירה: JavaScript + Python + שער public שמור, ללא דפדפן ופריסה
npm run verify         rem אימות מלא לפני העלאה
npm run clean:artifacts rem ניקוי __pycache__, bytecode ועותקי תמונת שיתוף ישנים
```

`npm test` כולל את שער ה־SEO הציבורי המלא. התוצר נשמר ב־`dist/site-public-preview`: חתימת מקורות ומלאי קבצים קובעים אם צריך לבנות מחדש, וחתימת ביקורת נפרדת קובעת אם צריך לסרוק שוב את כל דפי ה־HTML. לכן שינוי רלוונטי מפעיל בנייה וביקורת אמיתיות פעם אחת, ואילו הרצה חוזרת ללא שינוי מבצעת בדיקת עדכניות קלה בלבד. כך Windows Defender אינו נדרש לסרוק מאות קבצים חדשים בכל הרצה, בלי לדלג על שער הפרסום.


אפשר להפעיל את הניקוי גם דרך `.020-clean-project-artifacts.bat`. `.01-bundle-site-r2.bat` מפעיל אותו אוטומטית אחרי בנייה מוצלחת.

`npm run verify` מבצע לפי הסדר:

1. אימות שכל באנדלי המסלולים וקובצי ה־CSS מעודכנים.
2. אימות שכל ששת דפי האתר תואמים לתבניות, לתוכן הפוטר ול־footer המשותף.
3. בדיקת תחביר וכל בדיקות החוזה של JavaScript.
4. כל בדיקות Python.
5. בנייה או שימוש חוזר בתוצר public וביקורת SEO מלאה כשחתימת התוכן או כלי הביקורת השתנתה.
6. בדיקות Playwright בדפדפן אמיתי.
7. בניית חבילת Cloudflare Pages פרטית נקייה ואימות קובצי ה־hash.

בדיקות Playwright מכסות פתיחת קטלוג, תצוגה מקדימה ופתיחת עמוד נבחר, מעבר עמודים, חיפוש, שמירת מועדף לאחר רענון, שיתוף רשימת מועדפים לדפדפן נקי, קישור ישיר ושיתוף הכתובת המדויקת, חזרה מהצופה וניווט פנימי בטוח בזמן מסך מלא, סיור ההדרכה החד־פעמי, צפייה במובייל ושינוי orientation, מרכוז הצופה, כשל תמונה, ניווט מקלדת ובדיקות צילום מסך. בנוסף, כל מסלול נכשל אם נזרקת שגיאת JavaScript לא מטופלת בדפדפן. תמונות הקטלוג נענות בבדיקות באמצעות fixture מקומי, ולכן הבדיקות אינן תלויות ב־R2 או באינטרנט.

כאשר שינוי חזותי הוא מכוון, מעדכנים את תמונות הייחוס רק לאחר בדיקה ידנית שלהן:

```bat
npm run test:e2e:update
```

דוח HTML, traces וצילומי כשל נשמרים תחת `.artifacts` ואינם נכנסים לפריסה. אם מתקבלת הודעה ש־Chromium חסר, מריצים:

```bat
npm run setup:browsers
```

כלי הבנייה מאמת את גרף ה־imports של כל entrypoint מול manifest נבדק. קלטי compiler וירטואליים של esbuild נבדקים בנפרד מקובצי המקור, כך שתלות פיזית חדשה אינה יכולה להסתתר בגרף.

הקבצים הישנים `wp_logo_data.js` ו־`brand-logo.js` כבר אינם קיימים בפרויקט. אין צורך לחפש או למחוק אותם ידנית; בדיקות התחזוקה מוודאות שהם נשארים מחוץ למבנה.

## ניטור תפעולי ואבטחת האתר

האתר כולל מערכת ניטור מצומצמת ושומרת פרטיות. הממשק שולח אירועים מאושרים בלבד אל `/api/telemetry`, ו־Cloudflare Pages Function שומר אותם ב־Workers Analytics Engine. המערכת מודדת פתיחת קטלוגים, חיפושים שהושלמו ותוצאותיהם, שימוש במועדפים, פעולות יצירת קשר, שגיאות JavaScript/תמונה ובדפדפנים תומכים גם LCP, INP ו־CLS. הקלדה חלקית אינה נרשמת כחיפוש; אירוע נוצר רק בשליחה עם Enter או בפתיחת תוצאה. היא אינה יוצרת עוגיות או מזהה מבקר מתמשך, ואינה שולחת IP, User-Agent, referrer מלא או stack של שגיאה. Global Privacy Control ו־Do Not Track מכבים את המדידה בדפדפן. הדוח המקומי מציג אחוזון 75 ומגמות מול התקופה הקודמת.

הגדרת Cloudflare נמצאת ב־`wrangler.jsonc`, וה־Function נמצא ב־`functions/api/telemetry.js`. כלי ההעלאה בודק שהפרויקט, תיקיית הפלט וה־binding `SITE_TELEMETRY` תואמים לפני שהוא מפעיל את Wrangler.

לאחר העלאה אפשר לבדוק את בריאות השירות בכתובת:

```text
https://bargig-furniture.com/api/telemetry
```

לקבלת דוח מקומי מעתיקים את `telemetry.env.example` אל `telemetry.env` בשם המדויק הזה, ממלאים Account ID ו־API Token לקריאה בלבד, ואז מריצים. אם Windows או כלי חילוץ הוסיף סימני כיווניות לשם הקובץ, הכלי מזהה עותק יחיד כזה ומציג בקשה לשנות את שמו ל־`telemetry.env`:

```bat
.20-telemetry-report.bat 30
```

או:

```bat
npm run telemetry:report -- 30
```

הדוח אינו מודפס עוד בעברית בתוך PowerShell, מפני שמסופי Windows עלולים להציג טקסט דו־כיווני בצורה הפוכה. בכל הרצה נוצרים תחת `reports/telemetry` שני קבצים מתוארכים:

- דוח HTML עברי, מעוצב ומוגדר `dir=rtl`, שנפתח אוטומטית בדפדפן.
- קובץ CSV בקידוד UTF-8 עם BOM, המתאים לפתיחה ב־Excel.

אפשר להוסיף `--format json` ליצוא JSON, `--console` לתצוגת הטקסט הישנה, או `--output-dir PATH` לשינוי תיקיית היעד. קובצי הדוח מוחרגים מ־Git משום שהם עשויים להכיל נתונים עסקיים מצטברים.

כלי הדוח שולח ל־Analytics Engine שש שאילתות `SELECT` קטנות — אחת לכל אזור בדוח — ומאחד את התוצאות מקומית. אין שימוש ב־`UNION ALL` או ב־CTE. שורות שגיאה מקובצות לפי עמודות dataset ממשיות ומקבלות כותרת קריאה במחשב המקומי, מפני ש־Analytics Engine מאפשר ב־`GROUP BY` שמות עמודות בלבד.

הוראות מלאות, מבנה הנתונים, מצב ההשלמה ורשימת כותרות האבטחה נמצאים ב־`docs/monitoring-security.md`. תכנית ההשקה העתידית לגוגל נמצאת ב־`docs/google-search-launch-plan.md`.

`_headers` כולל כעת CSP מצומצם, מניעת iframe, `nosniff`, מדיניות referrer, Permissions Policy ו־HSTS. קוד הפניית HTTPS עבר ל־`https-redirect.js`, ועיצוב עמוד 404 עבר ל־`404.css`, כדי לאפשר `script-src 'self'` ללא JavaScript inline.

## בדיקת נכסי R2 וכתובות CDN

הפקודה הבאה בודקת את הכתובות המדויקות שהאתר מפיק, כולל מפתח הגרסה הנפרד לכל שכבת תמונה:

```bat
npm run verify:r2
```

או ישירות:

```bat
python tools\verify_remote_catalog_assets.py --base-url https://cdn.bargig-furniture.com --versioned
```

לבדיקת עצם קיום כל האובייקטים שנוצרו ב־R2, כולל שכבת Medium גם כאשר היא כבויה באתר, משתמשים ב־`npm run verify:r2:origin`. פרסום Pages דרך `.02-bundle-site-r2-upload cloudflare.bat` בודק רק את השכבות שהאתר הנוכחי באמת יבקש ומריץ אוטומטית את בדיקת כתובות הגרסה המלאה לפני ההעלאה, ולכן 404 שנשמר ב־CDN אינו יכול לעבור לפרסום חדש בשקט.

## מנוע החיפוש ואינדקס הגרסה

החיפוש הפעיל משתמש ב־`catalogs.search-index.json`, אינדקס הפוך ומנורמל שנבנה פעם אחת על ידי ה־Compiler. `src/runtime/catalog-search.js` הוא המקור הטיפוסי שמנהל בקשות וביטול שאילתות, ותוצר `catalog-search.js` נשאר ESM חיצוני ונפרד משלושת ה־Route bundles. `catalog-search-worker.js` מבצע את איתור המועמדים, הדירוג והפקת קטעי ההתאמה מחוץ ל־Main Thread.

בבאנדל הפריסה ה־Worker והאינדקס מקבלים שמות בעלי hash תחת `static/`. הנתיבים המדויקים נכתבים לתוך `catalog-search.js` לפני שגם הוא מקבל hash; לאחר מכן imports של כל Route bundle נכתבים ל־runtime המפוענח. בדיקת הבאנדל מאמתת את השרשרת HTML → Route ESM → Search ESM → Worker/index ואת תוכן כל קובץ, ולכן דפדפן אינו יכול לשלב generations שונים.

בדיקת הביצועים על מספר העמודים האמיתי זמינה ב־`npm run test:search-performance`, והיא נכללת גם בחוזי JavaScript של CI. בדיקת Playwright נוספת מפעילה האטת CPU פי 4 ומוודאת שהממשק נשאר מגיב ושרק תוצאת השאילתה האחרונה מוצגת. פירוט הארכיטקטורה נמצא ב־`docs/catalog-search-worker.md`.

## CI ובדיקות דפדפן

הקובץ `.github/workflows/ci.yml` מריץ ב־GitHub Actions את מסלול האימות המלא בכל push ובכל pull request: התקנת Node ו־Python, התקנת Chromium עם תלויות מערכת, בדיקות חוזה, כל בדיקות Python, מסעות Playwright ובניית באנדל נקי. בדיקות Playwright אינן דורשות את תמונות הקטלוגים ב־GitHub: הן מיירטות בקשות אל `assets/pages` ומחזירות תמונות SVG סינתטיות, כולל תרחישי כשל יזומים. במקרה כשל נשמרים דוח, trace וצילומי מסך כ־artifact למשך 14 יום.

## בדיקת release ציבורי בלי לפרסם

```bat
npm run verify:seo:public
```

פקודות ביקורת ה־SEO מופעלות דרך סביבת Python המקומית המנוהלת של הפרויקט (`.venv`), ולכן הן אינן תלויות בחבילות כמו Pillow המותקנות במקרה ב־Python הכללי של המחשב או של GitHub Actions.

הפקודה בונה או מאמתת באנדל public מוגן תחת `dist/site-public-preview`, בודקת נעילת
כתובות, קישורים פנימיים, canonical, H1, Open Graph, Twitter Card, JSON-LD,
robots.txt ו־sitemap. התוצר וחתימת הביקורת נשמרים בין הרצות; אם המקורות, מלאי
הקבצים או כלי הביקורת השתנו, ה־cache נפסל אוטומטית. ה־CI מעלה את התוצר כ־artifact
לצפייה, אך אינו מפרסם אותו.

לבדיקה יזומה ללא שימוש בתוצאת ביקורת קודמת מריצים
`npm run verify:seo:public:full`; לבנייה וביקורת מחדש מריצים
`npm run verify:seo:public:rebuild`.

בדיקה חיצונית לאחר deployment:

```bat
npm run verify:seo:live -- --expected-mode private
npm run verify:seo:live -- --expected-mode public
```

הוראות מלאות: `docs/public-search-release.md`.

## הכנה עתידית לחיפוש Google ושיתוף עשיר

האתר כולל כעת בנייה דו־מצבית. ברירת המחדל היא `private`, ולכן גם באנדל הפריסה
הרגיל נשאר חסום לאינדוקס ואינו יוצר sitemap. עמודי קטגוריה, קטלוג ועמוד מדויק
כן נוצרים עם כתובות נקיות, canonical, Open Graph, תמונת שיתוף ו־JSON-LD, כדי
שאפשר יהיה לבדוק את כל התשתית בלי לפתוח את האתר לחיפוש.

```bat
npm run build:seo:private
npm run build:deploy:private
```

מצב ציבורי דורש אישור מפורש נוסף ואינו אמור לשמש לפני יום ההשקה:

```bat
npm run build:seo:public
npm run build:deploy:public
```

`build:deploy:public` מאמת תחילה את `dist/site-public-preview`, ואז מעתיק את אותו
תוצר שעבר ביקורת אל `dist/site-upload-r2` ואל `dist/site-local`; הוא אינו מייצר
שוב את מאות הדפים לצורך ההעלאה.

הגדרות הדומיין ופרטי העסק נמצאות ב־`seo.config.json`; הטקסונומיה והכתובות של
הקטגוריות נמצאות ב־`catalog-taxonomy.config.json`. פירוט מלא נמצא ב־
`docs/seo-build-modes.md`.
