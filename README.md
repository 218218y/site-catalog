# אתר קטלוגים — Netlify + Cloudflare R2

הפרויקט מוגדר למסלול עבודה אחד וברור:

- האתר הסטטי עצמו עולה ל-Netlify.
- תמונות עמודי הקטלוגים נשמרות ומוגשות דרך Cloudflare R2 / CDN.
- תיקיית `assets/pages` נשארת תיקיית עבודה מקומית וסנכרון ל-R2; היא לא מועתקת לתיקיית ההעלאה ל-Netlify.

## מה מעלים ל-Netlify

אחרי יצירת הבאנדל מעלים ל-Netlify רק את תוכן התיקייה:

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
- ליצור באנדל R2 נקי להעלאה ל-Netlify.

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

ברירת המחדל היא `true`.

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
convert-catalogs-no-ocr.bat
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

### 7. יצירת באנדל R2 ל-Netlify

```bat
bundle-site-r2.bat
```

תוצאה:

```bat
dist\site-upload-r2
```

את תוכן התיקייה הזו מעלים ל-Netlify. הבאנדל לא מעתיק את `assets/pages`; התמונות נטענות מ-R2 דרך:

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

`r2.env` מכיל מפתחות גישה. לא מעלים אותו ל-Netlify ולא ל-GitHub.

## בדיקת תקינות לפני העלאה

אחרי `bundle-site-r2.bat`, בדוק שקיימים:

```bat
dist\site-upload-r2\index.html
dist\site-upload-r2\catalog-assets.config.js
```

בדוק שבתוך `dist\site-upload-r2\catalog-assets.config.js` מופיעה כתובת ה-CDN הנכונה.

בתיקיית ההעלאה לא אמורה להיות תיקיית:

```bat
assets\pages
```

אם התמונות לא מופיעות באתר אחרי העלאה, בדוק קודם את שלושת הדברים האלה:

1. `sync-r2-images.bat` הסתיים בלי שגיאה.
2. כתובת ה-CDN בקובץ `catalog-assets.config.js` נכונה.
3. הקבצים קיימים ב-R2 תחת הנתיב `assets/pages/...`.

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
tools/catalog_control_server.py    שרת מקומי שמפעיל פעולות קבועות ומעדכן קבצי קטלוגים
assets/pages                       תמונות מקומיות לסנכרון אל R2; לא מועתקות ל-Netlify
assets/pdfs                        קבצי PDF מקוריים; נשארים בפרויקט העבודה
bundle-site-r2.bat                 יצירת תיקיית העלאה נקייה ל-Netlify עם תמונות מ-R2
sync-r2-images-preview.bat         בדיקת תכנון סנכרון R2 בלי שינוי אמיתי
sync-r2-images.bat                 סנכרון R2 בפועל
r2.env.example                     תבנית להגדרת Cloudflare R2 מקומית
tools/build_deploy_bundle.py       בניית תיקיית ההעלאה ל-Netlify במסלול R2 בלבד
tools/sync_r2_catalog_images.py    כלי הסנכרון מול Cloudflare R2 ללא תלות ב-AWS CLI
sync-catalog-pdfs.bat              סריקת assets/pdfs והוספת PDFים חסרים לרשימה
convert-catalogs.bat               המרת PDF לתמונות ועדכון נתוני קטלוגים
convert-catalogs-no-ocr.bat        המרה בלי OCR גלובלי
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
