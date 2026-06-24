# אתר קטלוגים — פריסה מלאה ב-Netlify

הפרויקט הזה מוגדר עכשיו למסלול אחד בלבד: האתר והתמונות נטענים מאותה העלאה ל-Netlify.
אין צורך ב-Cloudflare R2, אין צורך ב-AWS CLI, אין סקריפטי sync חיצוניים לענן, ואין קובץ runtime שמחליף כתובת תמונות.

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

הנחת PDF בתיקייה עדיין לא ממירה אותו ולא משנה אוטומטית את האתר. כדי להוסיף קבצי PDF חדשים ל-`catalogs.config.json`, מריצים את סריקת ה-PDF הייעודית בשלב הבא.

### 3. סריקת PDF ועדכון `catalogs.config.json` בלבד

```bat
sync-catalog-pdfs.bat
```

הפקודה הזו רק סורקת את `assets\pdfs` ומוסיפה ל-`catalogs.config.json` קבצי PDF שלא רשומים עדיין בשום קטלוג. היא לא ממירה תמונות, לא מריצה OCR, ולא מעדכנת את `catalogs.generated.*`. אם שם PDF מכיל בטעות תווי כיוון נסתרים כמו `U+200F`, הסקריפט מנקה אותם משם הקובץ ומעדכן את הנתיב ב-JSON לנתיב נקי.

אחרי הסריקה ערוך ב-`catalogs.config.json` את `title`, `description` ו-`category` לפי הצורך.

### 4. המרת הקטלוגים לתמונות

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

ברירת המחדל בפקודות הרגילות חזרה למה שהיה קודם: WebP מהיר לדפדוף, רינדור ב-220DPI, מגבלה של 2800px בצד הארוך, איכות 84 לעמודים, ותמונות ממוזערות בגודל 420px.

אם כבר קיימות תמונות תקינות ב-`assets/pages`, הסקריפט מדלג עליהן ולא ממיר מחדש בלי צורך. כדי לבנות מחדש את התמונות באיכות החדשה, הרץ `convert-catalogs-force.bat`.

### רענון OCR בלבד

אם רוצים לרענן רק את אינדקס החיפוש בלי לרנדר מחדש תמונות קיימות:

```bat
refresh-ocr-search.bat
```

ה-OCR במצב ברירת המחדל משתמש קודם בטקסט האמיתי שמוטמע ב-PDF, ומריץ OCR רגיל רק בעמודים סרוקים/ריקים מטקסט. הוא לא מנסה יותר לנחש כותרות, סרטים צבעוניים או טקסט לבן מתוך התמונה עצמה, כדי לא להכניס תווים שגויים לאינדקס החיפוש.

### 5. יצירת תיקיית העלאה נקייה ל-Netlify

ברירת המחדל נשארה כמו קודם: האתר והתמונות נבנים יחד, וכל `assets/pages` מועתק לתיקיית ההעלאה.

```bat
bundle-site.bat
```

תוצאה:

```bat
dist\site-upload
```

את התוכן של התיקייה הזו מעלים ל-Netlify.

אפשרות נוספת: באנדל אתר בלבד, בלי להעתיק את `assets/pages`, כשהתמונות נטענות מ-Cloudflare R2:

```bat
bundle-site-r2.bat
```

תוצאה:

```bat
dist\site-upload-r2
```

את התוכן של התיקייה הזו מעלים ל-Netlify. התמונות ייטענו מתוך:

```text
https://pub-5e6c7421563f4086ba1e097bb88f3348.r2.dev/assets/pages/...
```

אם רוצים להשתמש בכתובת חיצונית אחרת במקום ה-R2 של ברגיג:

```bat
bundle-site.bat --external-assets-url https://example.r2.dev
```

אם רוצים גם ZIP של תיקיית ההעלאה:

```bat
bundle-site.bat --zip
```

זה ייצור בנוסף:

```bat
dist\site-upload.zip
```

## בדיקת תקינות מהירה

בבאנדל רגיל, בדוק שקיימים קבצים כמו:

```bat
dist\site-upload\index.html
dist\site-upload\assets\pages\<catalog-id>\page-001.webp
dist\site-upload\assets\pages\<catalog-id>\thumbs\page-001.webp
```

בבאנדל R2, בדוק שקיים קובץ ההגדרה ושהוא מכיל את כתובת R2:

```bat
dist\site-upload-r2\index.html
dist\site-upload-r2\catalog-assets.config.js
```

במצב R2 לא אמורה להיווצר בתוך תיקיית ההעלאה תיקיית `assets/pages`, כי התמונות כבר נמצאות באחסון החיצוני.

אם `bundle-site.bat` הרגיל נכשל עם הודעה ש-`assets/pages` לא קיים, המשמעות היא שלא בוצעה המרה עדיין או שהתמונות לא נמצאות בפרויקט. הרץ קודם `convert-catalogs.bat`, או השתמש ב-`bundle-site-r2.bat` אם התמונות כבר קיימות ב-R2.

## הוספת קטלוג חדש

1. העתק את ה-PDF לתוך `assets/pdfs`.
2. הרץ:

```bat
sync-catalog-pdfs.bat
```

3. אם ה-PDF עדיין לא היה רשום, הסקריפט יוסיף אותו ל-`catalogs.config.json` עם:
   - `id`: שם הקובץ בצורה בטוחה לשימוש כתיקייה
   - `title`: שם הקובץ בלי הסיומת `.pdf`
   - `description`: ריק
   - `category`: ריק
   - `pdf`: הנתיב לקובץ בתוך `assets/pdfs`

   אם ה-PDF הגיע עם תווי כיוון נסתרים בשם הקובץ, למשל `U+200F`, הסקריפט ינקה אותם משם הקובץ לפני הכתיבה ל-JSON כדי שהנתיב יהיה קריא ורגיל.
4. ערוך ב-`catalogs.config.json` את הכותרת, התיאור והקטגוריה לפי הצורך.
5. הרץ המרה:

```bat
convert-catalogs.bat
```

6. הרץ באנדל והעלה לאתר:

```bat
bundle-site.bat
```

7. העלה את `dist/site-upload` ל-Netlify.

## קבצים חשובים בפרויקט

```text
index.html                  דף האתר הראשי
styles.css                  עיצוב האתר
app.js                      לוגיקת הצופה והניווט
catalog-search.js           חיפוש בתוך הקטלוגים
catalog-snapshot.js         הורדת/צילום עמוד עם הלוגו
catalog-assets.config.js    הגדרת בסיס חיצוני לתמונות; ריק בבאנדל רגיל, כתובת R2 בבאנדל חיצוני
catalogs.config.json        רשימת הקטלוגים; קבצי PDF חדשים מתווספים אליו בהרצת sync-catalog-pdfs.bat
catalogs.generated.js       נתוני קטלוגים שנוצרו אוטומטית
catalogs.search.js          אינדקס חיפוש שנוצר אוטומטית
assets/pages                תמונות הקטלוגים שמועלות עם האתר ל-Netlify בבאנדל רגיל
assets/pdfs                 קבצי PDF מקוריים, נשארים בפרויקט ולא נדרשים בבאנדל
bundle-site.bat             יצירת תיקיית העלאה נקייה רגילה, כולל תמונות
bundle-site-r2.bat          יצירת תיקיית העלאה נקייה בלי תמונות; התמונות נטענות מ-R2
sync-catalog-pdfs.bat       סריקת assets/pdfs והוספת PDFים חסרים ל-catalogs.config.json בלבד
convert-catalogs.bat        המרת PDF לתמונות ועדכון נתוני הקטלוגים
```

## מסלולי תמונות נתמכים

יש עכשיו שני מסלולים רשמיים:

1. באנדל רגיל: האתר טוען תמונות בנתיבים יחסיים רגילים, לדוגמה:

```text
assets/pages/qualita/page-001.webp
```

2. באנדל R2: אותם נתיבים יחסיים נשארים בנתוני הקטלוגים, אבל `catalog-assets.config.js` מוסיף להם בסיס חיצוני, לדוגמה:

```text
https://pub-5e6c7421563f4086ba1e097bb88f3348.r2.dev/assets/pages/qualita/page-001.webp
```

הפתרון הזה עובד גם באתר הראשי וגם בדף `catalog-big-pages-viewer-netfree/catalog-big-pages-viewer.html`.
