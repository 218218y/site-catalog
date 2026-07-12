# אתר קטלוגים — Cloudflare Pages + Cloudflare R2

הפרויקט מוגדר למסלול עבודה אחד וברור:

- האתר מחולק לארבעה מסמכי ניווט: `index.html`, `catalog.html`, `favorites.html`, `viewer.html`.
- כל הקטלוגים משתמשים באותו `catalog.html` ובאותו `viewer.html` עם כתובת ייחודית לפי `catalog` ו-`page`; אין שכפול HTML לכל קטלוג.
- `site.template.html` הוא מקור ה-HTML המשותף, ו-`tools/build_site_pages.py` מייצר ממנו את ארבעת הדפים.
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
```

לא עורכים ידנית את ארבעת קובצי ה-HTML במקביל. עורכים את `site.template.html` ואז מריצים:

```bat
python tools\build_site_pages.py
```

כלי יצירת הבאנדל מרנדר את הדפים מהתבנית מחדש באופן אוטומטי, כך שגם אם קובץ HTML שנוצר מקומית התיישן, תיקיית הפריסה נשארת עקבית.

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

אפשרויות תחזוקה נוספות:

```bat
convert-catalogsdelete.bat
convert-catalogs-force.bat
convert-catalogs-deleteforce.bat
refresh-ocr-search.bat
```

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

אחרי שהבאנדל נוצר, אפשר להעלות אותו ידנית עם:

```bat
bundle-site-r2-upload cloudflare.bat
```

לפני העלאת Pages, כלי הפריסה מחיל ומאמת אוטומטית את מדיניות ה-CORS שבקובץ `r2-cors.json` על bucket התמונות `bargig-catalog`. רק לאחר שהגדרת ה-R2 הצליחה, הוא מריץ את העלאת האתר:

```bat
npx --yes wrangler pages deploy "dist\site-upload-r2" --project-name bargig-catlog --branch main
```

כדי להחיל ולאמת רק את מדיניות CORS, בלי להעלות את האתר:

```bat
configure-r2-cors.bat
```

אם רוצים ליצור באנדל חדש ומיד להעלות באותה פעולה:

```bat
bundle-site-r2-upload cloudflare.bat --build-first
```

אותה העלאה זמינה גם בלוח השליטה בכפתור “העלאת באנדל ל-Cloudflare”.

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
4. `configure-r2-cors.bat` הסתיים בהצלחה, או שהעלאת Pages החילה את `r2-cors.json` בלי שגיאה.

## קבצים חשובים בפרויקט

```text
index.html                         דף האתר הראשי
styles.css                         עיצוב האתר
app.js                             לוגיקת הצופה והניווט
catalog-search.js                  חיפוש בתוך הקטלוגים
catalog-snapshot.js                הורדת/צילום עמוד עם הלוגו
catalog-assets.config.js           הגדרת בסיס תמונות; בבאנדל R2 נכתב לתוכו URL של ה-CDN
catalogs.config.json               רשימת הקטלוגים לעריכה
catalogs.generated.js              נתוני קטלוגים שנוצרו אוטומטית
catalogs.search.js                 אינדקס חיפוש שנוצר אוטומטית
catalog-control-panel.bat          פתיחת לוח השליטה המקומי
catalog-control-panel.html         ממשק לוח השליטה המקומי
bundle-site-r2-upload cloudflare.bat      החלת CORS על R2 והעלאת dist/site-upload-r2 ל-Cloudflare Pages
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
tools/deploy_cloudflare_pages.py  החלת CORS על R2 והעלאה קבועה ל-Cloudflare Pages דרך Wrangler
tools/sync_r2_catalog_images.py    כלי הסנכרון מול Cloudflare R2 ללא תלות ב-AWS CLI
sync-catalog-pdfs.bat              סריקת assets/pdfs והוספת PDFים חסרים לרשימה
convert-catalogs.bat               המרת PDF לתמונות ועדכון נתוני קטלוגים
convert-catalogsdelete.bat         המרה + מחיקת תיקיות קטלוגים לא רשומים
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
