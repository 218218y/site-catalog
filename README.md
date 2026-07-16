# אתר קטלוגים — Cloudflare Pages + Cloudflare R2

הפרויקט מוגדר למסלול עבודה אחד וברור:

- האתר מחולק לארבעה מסמכי אפליקציה: `index.html`, `catalog.html`, `favorites.html`, `viewer.html`, ולשני מסמכים משפטיים: `terms.html`, `privacy.html`.
- כל הקטלוגים משתמשים באותו `catalog.html` ובאותו `viewer.html` עם כתובת ייחודית לפי `catalog` ו-`page`; אין שכפול HTML לכל קטלוג.
- `site.template.html` ו-`legal.template.html` הם מקורות ה-HTML המשותפים, ו-`tools/build_site_pages.py` מייצר מהם את ששת הדפים הציבוריים.
- `partials/site-footer.html` שומר את מבנה ועיצוב הפוטר, ו-`partials/site-footer.content.json` שומר רק את הטקסטים והפרטים הניתנים לעריכה.
- קוד המקור של הממשק מחולק לפי תחומים תחת `src/js` ו-`src/css`; כלי הבנייה מאחד אותו ל-`app.js` ול-`styles.css`, ולכן הדפדפן ממשיך להוריד רק שני קבצים משותפים.
- `site-routes.js` מרכז את בניית הכתובות ופענוחן עבור מבנה הדפים הנוכחי.
- האתר הסטטי עצמו עולה ל-Cloudflare Pages דרך Wrangler.
- תמונות עמודי הקטלוגים נשמרות ומוגשות דרך Cloudflare R2 / CDN.
- תיקיית `assets/pages` נשארת תיקיית עבודה מקומית וסנכרון ל-R2; היא לא מועתקת לתיקיית ההעלאה ל-Cloudflare Pages.

## מבנה דפי האתר

```text
index.html                         רשימת הקטלוגים
catalog.html?catalog=<id>          גלריית העמודים של קטלוג יחיד
favorites.html                    המועדפים כדף עצמאי
viewer.html?catalog=<id>&page=<n> צפייה במסך מלא
terms.html                         תנאי שימוש
privacy.html                       מדיניות פרטיות
```

לא עורכים ידנית את קובצי ה-HTML שנוצרו. עורכים את התבניות והחלקים המשותפים ואז מריצים:

```bat
python tools\build_site_pages.py
```

כלי יצירת הבאנדל מרנדר את הדפים מהתבנית מחדש באופן אוטומטי, כך שגם אם קובץ HTML שנוצר מקומית התיישן, תיקיית הפריסה נשארת עקבית. טקסט הפוטר נערך בדרך כלל דרך לוח השליטה; השמירה מעדכנת את קובץ התוכן ובונה מיד מחדש את כל ששת הדפים.


## מבנה קוד הממשק

הקבצים `app.js` ו-`styles.css` הם קובצי באנדל שנוצרים אוטומטית. אין לערוך אותם ישירות, מפני שהבנייה הבאה תחליף אותם.

מקורות JavaScript נמצאים תחת `src/js` בעשרה תחומים גדולים. הצופה מחולק כעת לשלוש אחריויות אמיתיות: ליבת הצופה, הדרכת הכניסה וקלט/מחוות. רישום האירועים נמצא לצד הפיצ’ר שמטפל בו, בעוד `90-bootstrap.js` נשאר שכבת חיבור ואתחול בלבד. מקורות CSS נמצאים תחת `src/css` באחת־עשרה שכבות; עיצוב ההדרכה הופרד מה-foundation, ושכבת התיקונים המאוחרת פוצלה לרספונסיביות, מועדפים/ניווט ופינישים חזותיים — בלי לשנות את סדר ה-cascade.

לבנייה ידנית של קובצי הממשק בלבד:

```bat
python tools\build_frontend_assets.py
```

לבדיקה שקובצי הבאנדל מעודכנים בלי לשנות דבר:

```bat
python tools\build_frontend_assets.py --check
```

`build_site_pages.py`, יצירת באנדל הפריסה והשרת המקומי מריצים את בניית הממשק אוטומטית. תיקיות `src/js` ו-`src/css` נשארות בפרויקט העבודה ואינן מועלות לאתר; בפריסה נשלחים רק `app.js` ו-`styles.css` המאוחדים והחתומים ב-hash. קוד ה-JavaScript המאוחד עטוף ב-scope פרטי וב-`strict mode`, ולכן פונקציות המימוש אינן דולפות ל-`window`. כלי הבנייה גם מאמת שמות, סדר וכפילויות במניפסט המודולים לפני כתיבה.

מפת האחריות, כיוון התלויות וכללי התחזוקה מפורטים ב־`docs/frontend-architecture.md`.

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
catalog-control-panel.bat
```

הלוח נפתח דרך שרת מקומי בכתובת `127.0.0.1:8765`. חשוב לפתוח אותו רק דרך `catalog-control-panel.bat`, כי השרת הזה מספק את כתובות ה-API שהכפתורים צריכים. פתיחה של `catalog-control-panel.html` דרך שרת האתר הרגיל תציג דף, אבל הפעולות לא יעבדו.

דרך לוח השליטה אפשר:

- להוסיף PDFים חסרים לרשימת הקטלוגים.
- לערוך כותרת, תיאור, קטגוריה, תת־קטגוריה והגדרת OCR.
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
setup-windows.bat
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
convert-catalogs.bat
```

הפקודה יוצרת/מעדכנת:

```bat
assets\pages
catalogs.generated.js
catalogs.generated.json
catalogs.search.js
catalogs.search.json
```

אם כבר קיימות תמונות תקינות, הסקריפט מדלג עליהן ולא מרנדר מחדש בלי צורך. אם אינדקס החיפוש חסר או שצריך OCR מעודכן, הוא מרענן את החיפוש ככל האפשר בלי לגעת בתמונות קיימות.

בכל הרצה מתבצע גם ניקוי עקבי:

- קטלוג שהוסר מתוך `catalogs.config.json` נמחק מתוך `assets/pages` ומאינדקס החיפוש שנוצר.
- קטלוג שעדיין רשום אבל קובץ ה־PDF שלו כבר לא קיים מוסר אוטומטית מתוך `catalogs.config.json`, תיקיית התמונות שלו נמחקת והוא מוסר מאינדקס החיפוש.
- קובצי PDF קיימים לעולם אינם נמחקים על ידי פקודת ההמרה.

אפשרויות תחזוקה נוספות:

```bat
convert-catalogs-force.bat
refresh-ocr-search.bat
```

`convert-catalogs-force.bat` מבצע את אותו ניקוי, אבל מרנדר מחדש בהכרח את כל קובצי ה־PDF שנותרו.

### 5. בדיקת סנכרון R2 לפני שינוי אמיתי

```bat
sync-r2-images-preview.bat
```

הפקודה מציגה מה יועלה, מה יימחק ומה כבר זהה ב-R2. היא לא משנה כלום ב-bucket.

### 6. סנכרון תמונות ל-Cloudflare R2

```bat
sync-r2-images.bat
```

הסנכרון:

- מעלה תמונות חדשות.
- מעלה מחדש רק תמונות שהשתנו.
- מוחק מה-R2 קבצים שנמצאים תחת `assets/pages/` ב-bucket אבל כבר לא קיימים מקומית.

אם רוצים לסנכרן בלי מחיקות:

```bat
sync-r2-images.bat --no-delete
```

אם רוצים פירוט מלא בתצוגה המקדימה:

```bat
sync-r2-images-preview.bat --show-all
```

### 7. יצירת באנדל R2 ל-Cloudflare Pages

```bat
bundle-site-r2.bat
```

תוצאה:

```bat
dist\site-upload-r2
```

את התיקייה הזו מעלים ל-Cloudflare Pages. הבאנדל לא מעתיק את `assets/pages`; התמונות נטענות מ-R2 דרך:

```text
https://cdn.bargig-furniture.com/assets/pages/...
```

אם צריך כתובת CDN אחרת:

```bat
bundle-site-r2.bat --external-assets-url https://cdn.example.com
```

אם רוצים גם ZIP של תיקיית ההעלאה:

```bat
bundle-site-r2.bat --zip
```

זה ייצור בנוסף:

```bat
dist\site-upload-r2.zip
```

### 8. העלאת הבאנדל ל-Cloudflare Pages

אפשר לבנות ולהעלות בפעולה אחת עם:

```bat
bundle-site-r2-upload cloudflare.bat
```

כלי ההעלאה בונה תחילה תיקיית ביניים נקייה, מנרמל שורות CSS/JS כדי שה־hash יהיה זהה ב־Windows ובלינוקס, ומאמת שכל קובץ שה־HTML מפנה אליו קיים וששם ה־hash תואם לתוכן. רק לאחר שכל הבדיקות עברו הוא מחליף את `dist\site-upload-r2` בשלמותה ומעלה אותה ל־Pages. בכל העלאה קיימת רק גרסה נוכחית אחת של קובצי ה־CSS/JS; קבצים מדורות קודמים אינם נשמרים. הכלי משנה רק את אתר ה־Pages ואינו קורא או מעדכן את הגדרות ה־CORS של R2.

העלאת production מתבצעת בלי `--branch`. ב־Cloudflare Pages הפרמטר `--branch` מיועד לפריסת preview; לכן הכלי משתמש בו רק כאשר מעבירים במפורש `--preview-branch NAME`.

אחרי ש־Wrangler מדווח שההעלאה הסתיימה בהצלחה, כלי ההעלאה מסיים מיד ואינו פונה לאתר הציבורי ואינו משווה את ה־HTML או את רשימת קובצי ה־CSS/JS מול הדומיין. כך תוספות שמוזרקות בדרך על ידי סינון, Proxy או שירות צד שלישי אינן הופכות העלאה תקינה לשגיאה. בדיקות השלמות המקומיות של הבאנדל עדיין מתבצעות תמיד לפני ההעלאה: כל קובץ CSS/JS שה־HTML מפנה אליו חייב להתקיים, להיות תחת `static`, ולהכיל בשם את ה־hash התואם לתוכן; דורות ישנים שאינם בשימוש נדחים.

הקובץ העליון `404.html` ומדיניות ה־cache שב־`_headers` נשארו בבאנדל עצמו, אך כלי ההעלאה אינו בודק אותם דרך הרשת לאחר הפריסה.

ב־Caching > Configuration יש להשאיר את **Browser Cache TTL** על **Respect Existing Headers**. תמונות מקומיות תחת `/assets/pages/*` וקובצי `static` בעלי hash נשמרים לשנה עם `immutable`; התמונות החיות שמגיעות מ־R2/CDN ממשיכות להשתמש במדיניות ה־cache של אותו שירות ואינן מושפעות מ־`_headers` של Pages.

```bat
python tools\build_deploy_bundle.py --out dist\site-upload-r2 --external-assets-url https://cdn.bargig-furniture.com
npx --yes wrangler pages deploy "dist\site-upload-r2" --project-name bargig-catlog
```

לפריסת preview בלבד:

```bat
python tools\deploy_cloudflare_pages.py --preview-branch test-name
```

ה־CORS הוא הגדרה חד־פעמית/תחזוקתית נפרדת. רק כאשר צריך לשנות אותה במפורש, מריצים:

```bat
configure-r2-cors.bat
```

הפרמטר הישן `--build-first` עדיין נתמך לצורך תאימות, אבל כבר אינו נחוץ. אין אפשרות לדלג על הבנייה דרך כלי ההעלאה, כדי שלא ניתן יהיה לפרוס בטעות תיקיית `dist` ישנה או חלקית.

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

אחרי `bundle-site-r2.bat`, בדוק שקיימים:

```bat
dist\site-upload-r2\index.html
dist\site-upload-r2\_headers
dist\site-upload-r2\static\*.js
dist\site-upload-r2\static\*.css
```

קבצי ה־CSS/JS בבאנדל ההעלאה מקבלים שם עם hash לפי תוכן, לדוגמה
`static\app.abc123def456.js`. לכן אחרי עדכון אתר הדפדפן מבקש URL חדש ולא נתקע על
`app.js` ישן מה־cache. כתובת ה־CDN של R2 נכתבת לתוך קובץ ההגדרה לפני ה־hash,
ולכן גם שינוי כתובת CDN מקבל שם קובץ חדש בבאנדל.

בתיקיית ההעלאה לא אמורה להיות תיקיית:

```bat
assets\pages
```

אם התמונות לא מופיעות באתר אחרי העלאה, בדוק קודם את שלושת הדברים האלה:

1. `sync-r2-images.bat` הסתיים בלי שגיאה.
2. הרצת `bundle-site-r2.bat` מחדש אחרי שינוי כתובת CDN או שינוי קוד.
3. הקבצים קיימים ב-R2 תחת הנתיב `assets/pages/...`.
4. אם זו הקמה ראשונית או ששינית את המדיניות, `configure-r2-cors.bat` הסתיים בהצלחה.

## קבצים חשובים בפרויקט

```text
index.html                         דף האתר הראשי
src/css/                           מקורות העיצוב לפי תחומים; נערכים ידנית
src/js/                            מקורות JavaScript לפי תחומים; נערכים ידנית
styles.css                         באנדל CSS שנוצר אוטומטית מכל src/css
app.js                             באנדל JavaScript שנוצר אוטומטית מכל src/js
tools/build_frontend_assets.py    בנייה אטומית ובדיקת עדכניות של שני קובצי הממשק
catalog-search.js                  חיפוש בתוך הקטלוגים
catalog-snapshot.js                הורדת/צילום עמוד עם הלוגו
catalog-assets.config.js           הגדרת בסיס תמונות; בבאנדל R2 נכתב לתוכו URL של ה-CDN
catalogs.config.json               רשימת הקטלוגים לעריכה
partials/site-footer.html          תבנית מבנה הפוטר; העיצוב והתגיות נשארים קבועים
partials/site-footer.content.json  טקסטי הפוטר הנערכים דרך לוח השליטה
tools/footer_content.py            אימות, escaping ובניית קישורי הפוטר מתוך קובץ התוכן
catalogs.generated.js              נתוני קטלוגים שנוצרו אוטומטית
catalogs.search.js                 אינדקס חיפוש שנוצר אוטומטית
catalog-control-panel.bat          פתיחת לוח השליטה המקומי
catalog-control-panel.html         ממשק לוח השליטה המקומי
bundle-site-r2-upload cloudflare.bat      העלאת dist/site-upload-r2 ל-Cloudflare Pages בלבד
configure-r2-cors.bat               החלה ואימות של מדיניות CORS בלבד
r2-cors.json                        מדיניות קריאת GET/HEAD מהדפדפן עבור bucket התמונות הציבורי
tools/catalog_control_server.py    שרת מקומי שמפעיל פעולות קבועות ומעדכן קבצי קטלוגים
assets/pages                       תמונות מקומיות לסנכרון אל R2; לא מועתקות לבאנדל ההעלאה
assets/pdfs                        קבצי PDF מקוריים; נשארים בפרויקט העבודה
bundle-site-r2.bat                 יצירת תיקיית העלאה נקייה ל-Cloudflare Pages עם תמונות מ-R2
sync-r2-images-preview.bat         בדיקת תכנון סנכרון R2 בלי שינוי אמיתי
sync-r2-images.bat                 סנכרון R2 בפועל
r2.env.example                     תבנית להגדרת Cloudflare R2 מקומית
tools/build_deploy_bundle.py       בניית תיקיית ההעלאה ל-Cloudflare Pages במסלול R2 בלבד
tools/deploy_cloudflare_pages.py  העלאה קבועה ל-Cloudflare Pages דרך Wrangler; CORS רק במצב תחזוקה מפורש
tools/sync_r2_catalog_images.py    כלי הסנכרון מול Cloudflare R2 ללא תלות ב-AWS CLI
sync-catalog-pdfs.bat              סריקת assets/pdfs והוספת PDFים חסרים לרשימה
convert-catalogs.bat               המרת PDF חדשים/שהשתנו + ניקוי קטלוגים שהוסרו או שחסר להם PDF
convert-catalogs-force.bat         המרה מחדש של כל ה-PDFים + אותו ניקוי אוטומטי
refresh-ocr-search.bat             רענון אינדקס חיפוש/OCR בלי רינדור תמונות מחדש ככל האפשר
```

## הפעלה מקומית

לאתר הראשי בלבד:

```bat
start-server.bat
```

או:

```bat
npx serve .
```

לוח השליטה לא עובד דרך השרת של האתר הראשי. בשביל לוח השליטה משתמשים ב:

```bat
catalog-control-panel.bat
```

## פקודות בנייה ובדיקה אחידות

הפרויקט משתמש כעת ב־`package.json` גם כתהליך עבודה אחיד וגם להרצת בדיקות דפדפן אמיתיות. אחרי קבלת הפרויקט במחשב חדש מריצים פעם אחת:

```bat
npm ci
npm run setup
```

`npm run setup` מכין את סביבת Python המקומית `.venv` ומתקין את Chromium המבודד של Playwright. אפשר במקום זאת להריץ את `setup-windows.bat`, שמבצע את כל השלבים האלה ברצף.

הפקודות המרכזיות:

```bat
npm run build          rem בניית app.js, styles.css וכל דפי HTML
npm run test:js        rem בדיקות JavaScript, תחביר ודפים שנוצרו
npm run test:python    rem בדיקות Python מתוך .venv
npm run test:e2e       rem מסלולי שימוש אמיתיים בדפדפן Chromium
npm test               rem בדיקה מהירה: JavaScript + Python, ללא דפדפן ופריסה
npm run verify         rem אימות מלא לפני העלאה
```

`npm run verify` מבצע לפי הסדר:

1. אימות שהבאנדלים `app.js` ו־`styles.css` מעודכנים.
2. אימות שכל ששת דפי האתר תואמים לתבניות, לתוכן הפוטר ול־footer המשותף.
3. בדיקת תחביר וכל בדיקות החוזה של JavaScript.
4. כל בדיקות Python.
5. בדיקות Playwright בדפדפן אמיתי.
6. בניית חבילת Cloudflare Pages נקייה ואימות קובצי ה־hash.

בדיקות Playwright מכסות פתיחת קטלוג, תצוגה מקדימה ופתיחת עמוד נבחר, מעבר עמודים, חיפוש, שמירת מועדף לאחר רענון, שיתוף רשימת מועדפים לדפדפן נקי, קישור ישיר ושיתוף הכתובת המדויקת, חזרה מהצופה וניווט פנימי בטוח בזמן מסך מלא, סיור ההדרכה החד־פעמי, צפייה במובייל ושינוי orientation, מרכוז הצופה, כשל תמונה, ניווט מקלדת ובדיקות צילום מסך. בנוסף, כל מסלול נכשל אם נזרקת שגיאת JavaScript לא מטופלת בדפדפן. תמונות הקטלוג נענות בבדיקות באמצעות fixture מקומי, ולכן הבדיקות אינן תלויות ב־R2 או באינטרנט.

כאשר שינוי חזותי הוא מכוון, מעדכנים את תמונות הייחוס רק לאחר בדיקה ידנית שלהן:

```bat
npm run test:e2e:update
```

דוח HTML, traces וצילומי כשל נשמרים תחת `.artifacts` ואינם נכנסים לפריסה. אם מתקבלת הודעה ש־Chromium חסר, מריצים:

```bat
npm run setup:browsers
```

כלי הבנייה של הממשק בודק גם שאין שני מודולי JavaScript שמצהירים על אותו שם top-level. הבדיקה חשובה משום שהמודולים מתאחדים ל־scope פרטי אחד בתוך `app.js`.

הקבצים הישנים `wp_logo_data.js` ו־`brand-logo.js` כבר אינם קיימים בפרויקט. אין צורך לחפש או למחוק אותם ידנית; בדיקות התחזוקה מוודאות שהם נשארים מחוץ למבנה.

## ניטור תפעולי ואבטחת האתר

האתר כולל מערכת ניטור מצומצמת ושומרת פרטיות. הממשק שולח אירועים מאושרים בלבד אל `/api/telemetry`, ו־Cloudflare Pages Function שומר אותם ב־Workers Analytics Engine. Cloudflare Web Analytics מודד ביקורים ומדדי ביצועים מצטברים. המערכת המותאמת מודדת רק פתיחת קטלוגים, חיפושים ותוצאותיהם, שימוש במועדפים, לחיצות יצירת קשר ושגיאות JavaScript/תמונה, כדי לא לאסוף את אותם נתונים פעמיים. היא אינה יוצרת עוגיות או מזהה מבקר מתמשך, ואינה שולחת IP, User-Agent, referrer מלא או stack של שגיאה. Global Privacy Control ו־Do Not Track מכבים את המדידה בדפדפן.

הגדרת Cloudflare נמצאת ב־`wrangler.jsonc`, וה־Function נמצא ב־`functions/api/telemetry.js`. כלי ההעלאה בודק שהפרויקט, תיקיית הפלט וה־binding `SITE_TELEMETRY` תואמים לפני שהוא מפעיל את Wrangler.

לאחר העלאה אפשר לבדוק את בריאות השירות בכתובת:

```text
https://bargig-furniture.com/api/telemetry
```

לקבלת דוח מקומי מעתיקים את `telemetry.env.example` אל `telemetry.env` בשם המדויק הזה, ממלאים Account ID ו־API Token לקריאה בלבד, ואז מריצים. אם Windows או כלי חילוץ הוסיף סימני כיווניות לשם הקובץ, הכלי מזהה עותק יחיד כזה ומציג בקשה לשנות את שמו ל־`telemetry.env`:

```bat
telemetry-report.bat 30
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
