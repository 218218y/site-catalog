# אתר קטלוגים — פריסה מלאה ב-Netlify

הפרויקט הזה מוגדר עכשיו למסלול אחד בלבד: האתר והתמונות נטענים מאותה העלאה ל-Netlify.
אין צורך ב-Cloudflare R2, אין צורך ב-AWS CLI, אין סקריפטי sync חיצוניים, ואין קובץ runtime שמחליף כתובת תמונות.

## מה מעלים ל-Netlify

מעלים את התיקייה:

```bat
dist\site-upload
```

התיקייה נוצרת על ידי:

```bat
bundle-site.bat
```

הבאנדל כולל רק את מה שהדפדפן צריך:

- קבצי האתר: `index.html`, `styles.css`, `app.js` ושאר קבצי JavaScript הנדרשים.
- נתוני הקטלוגים שנוצרו: `catalogs.generated.js`, `catalogs.search.js`.
- התמונות המומרות של הקטלוגים: `assets/pages/...`.
- `_headers` בשביל cache תקין ב-Netlify.

הבאנדל לא כולל קבצי עבודה שאינם נדרשים לצפייה באתר: PDF מקוריים, כלי המרה, README, virtualenv, קבצי הגדרות וסקריפטים פנימיים.

## סדר עבודה מומלץ

### 1. התקנה ראשונית במחשב

רק בפעם הראשונה:

```bat
setup-windows.bat
```

### 2. הנחת קבצי PDF מקוריים

שים את קבצי ה-PDF בתיקייה:

```bat
assets\pdfs
```

ודא שהשמות תואמים לנתיבים שמופיעים ב-`catalogs.config.json`.

### 3. המרת הקטלוגים לתמונות

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

ברירת המחדל היא WebP איכותי: רינדור ב-240DPI, מגבלה של 3200px בצד הארוך, איכות 90 לעמודים, ותמונות ממוזערות נפרדות בגודל 520px. זה נותן הגדלה יפה בלי להפוך כל דפדוף להובלת מקרר.

אם כבר קיימות תמונות תקינות ב-`assets/pages`, הסקריפט מדלג עליהן ולא ממיר מחדש בלי צורך. כדי לבנות מחדש את התמונות באיכות החדשה, הרץ `convert-catalogs-force.bat`.

### רענון OCR בלבד

אם רוצים לרענן רק את אינדקס החיפוש בלי לרנדר מחדש תמונות קיימות:

```bat
refresh-ocr-search.bat
```

ה-OCR במצב ברירת המחדל משתמש קודם בטקסט האמיתי שמוטמע ב-PDF, ומריץ OCR רגיל רק בעמודים סרוקים/ריקים מטקסט. הוא לא מנסה יותר לנחש כותרות, סרטים צבעוניים או טקסט לבן מתוך התמונה עצמה, כדי לא להכניס תווים שגויים לאינדקס החיפוש.

### 4. יצירת תיקיית העלאה נקייה ל-Netlify

```bat
bundle-site.bat
```

תוצאה:

```bat
dist\site-upload
```

את התוכן של התיקייה הזו מעלים ל-Netlify.

אם רוצים גם ZIP של תיקיית ההעלאה:

```bat
bundle-site.bat --zip
```

זה ייצור בנוסף:

```bat
dist\site-upload.zip
```

## בדיקת תקינות מהירה

לפני העלאה, בדוק שקיימים קבצים כמו:

```bat
dist\site-upload\index.html
dist\site-upload\assets\pages\<catalog-id>\page-001.webp
dist\site-upload\assets\pages\<catalog-id>\thumbs\page-001.webp
```

אם `bundle-site.bat` נכשל עם הודעה ש-`assets/pages` לא קיים, המשמעות היא שלא בוצעה המרה עדיין או שהתמונות לא נמצאות בפרויקט. הרץ קודם `convert-catalogs.bat`.

## הוספת קטלוג חדש

1. העתק את ה-PDF לתוך `assets/pdfs`.
2. הוסף רשומה ל-`catalogs.config.json` עם `id`, `title`, `description`, `category`, ו-`pdf`.
3. הרץ:

```bat
convert-catalogs.bat
bundle-site.bat
```

4. העלה את `dist/site-upload` ל-Netlify.

## קבצים חשובים בפרויקט

```text
index.html                  דף האתר הראשי
styles.css                  עיצוב האתר
app.js                      לוגיקת הצופה והניווט
catalog-search.js           חיפוש בתוך הקטלוגים
catalog-snapshot.js         הורדת/צילום עמוד עם הלוגו
catalogs.config.json        רשימת הקטלוגים לעריכה ידנית
catalogs.generated.js       נתוני קטלוגים שנוצרו אוטומטית
catalogs.search.js          אינדקס חיפוש שנוצר אוטומטית
assets/pages                תמונות הקטלוגים שמועלות עם האתר ל-Netlify
assets/pdfs                 קבצי PDF מקוריים, נשארים בפרויקט ולא נדרשים בבאנדל
bundle-site.bat             יצירת תיקיית העלאה נקייה
convert-catalogs.bat        המרת PDF לתמונות ועדכון נתוני הקטלוגים
```

## מה הוסר במסלול הנקי

הוסרו כל קבצי וסקריפטי R2/Cloudflare, כולל סקריפטי upload/sync, קבצי CORS, קובץ כתובת התמונות החיצונית, ובאנדל R2 שדילג על `assets/pages`.

האתר חוזר לטעון תמונות בנתיבים יחסיים רגילים, לדוגמה:

```text
assets/pages/qualita/page-001.webp
```

כלומר: מה שנמצא בתוך `dist/site-upload` הוא מה שהאתר משתמש בו בפועל.
