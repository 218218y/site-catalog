# אתר קטלוגים - רהיטי ברגיג / המרה מקומית מ-PDF לתמונות בלבד

זאת גרסה משופרת שמבוססת **רק על תמונות** של עמודי הקטלוג.

כלומר:
- ממירים אצלך במחשב את קבצי ה-PDF לתמונות איכותיות.
- האתר מציג רק את התמונות.
- אין כפתור הורדת PDF באתר.
- אחרי ההמרה אפשר אפילו למחוק את קבצי ה-PDF ולהשאיר רק את תיקיית `assets/pages`.

האתר כולל:
- דף בית מעוצב עם אנימציית פתיחה.
- כרטיסי קטלוגים.
- דף קטלוג עם **כל עמודי התמונות** של אותו קטלוג.
- אינדקס חיפוש שנבנה בזמן ההמרה מטקסט PDF ומ־OCR בעברית/אנגלית.
- חיפוש באתר לפי דגם, מספר או מילה מתוך הקטלוג, עם פתיחה ישירה של העמוד המתאים בתצוגה מוגדלת.
- לחיצה על עמוד פותחת תצוגה גדולה ונוחה עם:
  - חיצי דפדוף
  - תמונות ממוזערות בתחתית
  - הגדלה/הקטנה
  - תמיכה במקלדת (`←`, `→`, `Esc`)
  - תמיכה בהחלקה במובייל

---

## מה עושים בפועל ב-Windows

### 1. חילוץ

חלץ את ה-ZIP לתיקייה רגילה במחשב, לדוגמה:

```text
C:\bargig-catalog-site
```

### 2. העתקת קבצי PDF

הכנס את קבצי ה-PDF לתיקייה:

```text
assets\pdfs
```

ברירת המחדל מחפשת את הקבצים בשמות האלה:

```text
assets\pdfs\qualita-2026.pdf
assets\pdfs\komotayim-nagar-2026.pdf
assets\pdfs\tbi-arnot-pticha-2026.pdf
```

אפשר לשנות את שמות ה-PDF לשמות האלה,
או לערוך את `catalogs.config.json` ולהכניס שם את השמות המדויקים שלך.

### 3. התקנה חד-פעמית

לחץ פעמיים על:

```text
setup-windows.bat
```

זה יוצר סביבת Python מקומית בתיקייה `.venv` ומתקין:
- PyMuPDF – לקריאת PDF, חילוץ טקסט ורינדור עמודים
- Pillow – לשמירת JPG / PNG / WebP

שימו לב: OCR עצמו משתמש בתוכנת `tesseract` שמותקנת במחשב מחוץ ל־Python.
כדי שחיפוש בעברית יעבוד על PDF סרוק, צריך ש־Tesseract יזהה את השפה `heb`.
אם כבר מותקן אצלך `tesseract-ocr` עם עברית, אין צורך להוסיף חבילת Python בשביל זה.

### 4. המרת PDF לתמונות – הדרך המומלצת

לחץ פעמיים על:

```text
convert-catalogs.bat
```

זאת ברירת המחדל החדשה, והיא מייצרת:
- **WebP מהיר וקל יותר לטעינה**
- תמונות עמודים גדולות ואיכותיות
- תמונות ממוזערות מותאמות לגריד ולסרגלי הדפדוף
- תוצאה חדה, קלה יותר, ומתאימה במיוחד לאחסון חיצוני כמו Cloudflare R2

ההרצה הזאת עכשיו עובדת בצורה מצטברת:
- אם לקטלוג כבר קיימת תיקייה תקינה בתוך `assets\pages`, היא לא תמיר אותו מחדש.
- אם ה־PDF נמחק אבל התמונות שכבר הומרו קיימות, האתר ממשיך לשמור ולהציג אותן.
- כדי להמיר קטלוג מסוים מחדש, אפשר למחוק ידנית רק את התיקייה שלו מתוך `assets\pages`, ואז להריץ שוב.

לדוגמה, כדי להמיר מחדש רק את `qualita`:

```text
assets\pages\qualita
```

מוחקים את התיקייה הזאת בלבד, ומריצים שוב `convert-catalogs.bat`.

### 4.1 המרה מחדש של כל הקטלוגים בכוח

אם אתה רוצה לרנדר מחדש את כל הקטלוגים שקבצי ה־PDF שלהם קיימים, לחץ פעמיים על:

```text
convert-catalogs-force.bat
```

הסקריפט הזה משתמש ב־`--force`.
גם במצב הזה, קטלוג שאין לו PDF אבל כבר יש לו תיקיית תמונות תקינה — נשמר ולא נמחק.

### 5. אם אתה חייב JPG במקום WebP

לחץ על:

```text
convert-catalogs-jpg.bat
```

זה מייצר JPG איכותי וכבד יותר. ברוב המקרים WebP עדיף לאתר קטלוגים מהיר.

### 6. אם אתה רוצה מקסימום איכות בלי להתחשב במשקל

לחץ על:

```text
convert-catalogs-png.bat
```

זה יוצר PNG.
הקבצים יהיו הרבה יותר כבדים, אבל איכותית זאת האפשרות הכי חזקה.

### 7. צפייה באתר

אפשר לפתוח ישירות:

```text
index.html
```

או להריץ שרת מקומי:

```text
start-server.bat
```

ואז לפתוח בדפדפן:

```text
http://localhost:8080
```

---

## שדרוג לאחסון תמונות ב־Cloudflare R2

הגרסה הזו תומכת בהפרדה מקצועית בין האתר לבין קבצי הקטלוגים:

- **Netlify** מאחסן רק את האתר: HTML, CSS, JS, אינדקס חיפוש וקבצי הגדרה.
- **Cloudflare R2** מאחסן את התמונות הכבדות: `assets/pages/...`.
- האתר ממשיך להשתמש באותם שמות קבצים, אבל מוסיף להם כתובת בסיס של R2 מתוך `catalog-assets-config.js`.

### 1. הכנת תמונות WebP ואריזת תיקיית העלאה ל־R2

אחרי שהקטלוגים נמצאים אצלך בתיקיית `assets\pages`, לחץ על:

```text
build-r2-assets.bat
```

הפעולה עושה שלושה דברים:

1. מוודאת שהקטלוגים בנויים כ־WebP.
2. אם קיימות תמונות JPG/PNG ישנות, היא ממירה אותן ל־WebP בלי למחוק את המקור.
3. יוצרת תיקייה להעלאה ל־R2:

```text
dist\r2-assets
```

וגם ZIP נוח:

```text
dist\r2-assets.zip
```

את התוכן של `dist\r2-assets` מעלים ל־R2 **לשורש ה־bucket**, כך שהנתיבים יישארו בדיוק כך:

```text
assets/pages/tbi/page-001.webp
assets/pages/tbi/thumbs/page-001.webp
```

### 2. העלאה ל־R2 עם Wrangler

אם מותקן Node.js, אפשר להתחבר ל־Cloudflare פעם אחת:

```bash
npx wrangler login
```

ואז להפעיל:

```text
upload-r2-assets-wrangler.bat
```

הסקריפט יבקש את שם ה־bucket, יחיל CORS מתוך `r2-cors-wrangler.json`, ואז יעלה את כל הקבצים מתוך `dist\r2-assets`, עם:

```text
Cache-Control: public, max-age=31536000, immutable
```

זה מתאים כי התמונות מקבלות גם `?v=...` בקוד, כלומר כשהתוכן משתנה הדפדפן מקבל כתובת חדשה.

### 3. פתיחת גישה ציבורית / דומיין ציבורי ל־R2

הכתובת הזו **לא** מתאימה לשדה `baseUrl` באתר:

```text
https://7d352c315748f2f8c6e723c5fc46f606.r2.cloudflarestorage.com
```

זו כתובת **S3 API** של Cloudflare R2. משתמשים בה לכלי העלאה/SDK עם הרשאות, לא להצגת תמונות ישירות בדפדפן של גולשים.

צריך אחת משתי כתובות ציבוריות:

1. מומלץ לפרודקשן: R2 Custom Domain, לדוגמה:

```text
https://catalogs.your-domain.co.il
```

2. זמני לבדיקה: Public Development URL של R2, לדוגמה:

```text
https://pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev
```

את הכתובת הציבורית בודקים בדפדפן מול קובץ אמיתי שהעלית, לדוגמה:

```text
https://PUBLIC-R2-URL/assets/pages/tbi/page-001.webp
```

אם התמונה נפתחת בדפדפן בלי התחברות ובלי חתימה — זו הכתובת הנכונה ל־`baseUrl`.

### 4. CORS לטעינת תמונות ולכפתור צילום/הורדה

כדי שהאתר יוכל להציג תמונות מ־R2 וגם ליצור צילום עמוד מתוך canvas, צריך להגדיר CORS ב־R2.

נוסף קובץ:

```text
r2-cors-policy.json
```

הקובץ כבר עודכן לאתר Netlify הנוכחי:

```text
https://bargig-catalog.netlify.app
```

יש גם קובץ נוסף ל־Wrangler:

```text
r2-cors-wrangler.json
```

אם תוסיף בעתיד דומיין אמיתי לאתר במקום Netlify, צריך להוסיף גם אותו לרשימת ה־origins.

### 5. חיבור האתר ב־Netlify לתמונות ב־R2

אחרי שיש לך כתובת ציבורית אמיתית של R2, הכי פשוט להריץ:

```text
set-r2-public-url.bat https://PUBLIC-R2-URL
```

לדוגמה זמנית עם `r2.dev`:

```text
set-r2-public-url.bat https://pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev
```

או עם דומיין מותאם:

```text
set-r2-public-url.bat https://catalogs.your-domain.co.il
```

הסקריפט יעדכן את `catalog-assets-config.js`, וידחה בטעות כתובת של S3 API כמו `.r2.cloudflarestorage.com`.

לא מוסיפים `/assets/pages` בסוף. האתר מוסיף את הנתיב לבד.

### 6. בניית ZIP נקי ל־Netlify בלי התמונות הכבדות

אחרי שה־R2 עובד וה־baseUrl מוגדר, לחץ על:

```text
bundle-site-r2.bat
```

זה יוצר אתר ל־Netlify בלי `assets/pages`:

```text
dist\site-upload
dist\site-upload.zip
```

את זה מעלים ל־Netlify. התמונות עצמן ייטענו מ־R2.

### 7. בדיקה מהירה אחרי העלאה

בדפדפן פתח DevTools → Network ובדוק:

- קבצי `page-001.webp` נטענים מהדומיין של R2, לא מ־Netlify.
- התמונות הן `image/webp`.
- אין שגיאות CORS.
- בעמודי הקטלוג התמונות נטענות בהדרגה ולא כולן בבת אחת.

אם האתר נראה תקין אבל כפתור צילום/הורדה נכשל — כמעט תמיד זו בעיית CORS ב־R2.

---

## תצוגת קטלוג במסך מלא

בגרסה הזו הצפייה במסך מלא נמצאת בתוך `index.html`. אין יותר דף `catalog.html` נפרד, ולכן גם קובץ `catalog-viewer.js` הוסר מהפרויקט.

לחיצה על עמוד קטלוג פותחת אותו כמעט על כל המסך, בלי מסגרת גדולה ובלי סרגלים שתופסים מקום.

מה רואים כברירת מחדל:
- התמונה עצמה במסך מלא.
- חץ ימני וחץ שמאלי לדפדוף.

מה מופיע רק כשצריך:
- הזזת העכבר לתחתית המסך או על אחד החיצים פותחת פס תמונות ממוזערות.
- הזזת העכבר לחלק העליון פותחת סרגל קטן עם סגירה וזום.
- `Esc` סוגר את התצוגה הגדולה.
- חיצים במקלדת מדפדפים בין העמודים.

## חיפוש OCR בעברית

בזמן ההמרה נוצרים עכשיו שני קבצים נוספים:

```text
catalogs.search.js
catalogs.search.json
```

האתר משתמש ב־`catalogs.search.js` כדי לחפש דגמים בתוך עמודי הקטלוג.
הסקריפט עובד כך:

1. קודם מנסה לחלץ טקסט רגיל מתוך ה־PDF בעזרת PyMuPDF.
2. אם בעמוד אין מספיק טקסט, הוא מריץ OCR עם Tesseract.
3. ברירת המחדל היא עברית + אנגלית:

```bash
--ocr auto --ocr-lang heb+eng
```

אפשרויות שימושיות:

```bash
# OCR רק לעמודים שאין בהם שכבת טקסט
python tools/build_catalogs.py --ocr auto --ocr-lang heb+eng

# OCR לכל העמודים, שימושי אם שכבת הטקסט ב-PDF לא אמינה
python tools/build_catalogs.py --ocr always --ocr-lang heb+eng

# בלי OCR בכלל, רק חילוץ טקסט PDF
python tools/build_catalogs.py --ocr never

# להיכשל אם OCR נדרש אבל Tesseract/עברית לא זמינים
python tools/build_catalogs.py --require-ocr
```

אם החיפוש לא מוצא דגמים מתוך PDF סרוק, נסה להריץ פעם אחת עם `--ocr always`.


### תיקון ידני מדויק לשמות דגמים שה־OCR לא מזהה

בקטלוגים מצולמים יש מקרים ש־OCR לא יגיע ל־100%: טקסט זהוב על תמונה, רקע עמוס, אותיות דקות, או כתב שמוטמע כחלק מהתמונה. במקום להוסיף טקסט שקוף לתוך ה־PDF, הדרך היציבה יותר היא להוסיף טקסט חיפוש ידני בקובץ:

```text
catalogs.search-overrides.json
```

הקובץ לא משנה את התמונות באתר ולא מוסיף שום דבר שנראה לעין. הוא רק מוסיף מילים לאינדקס החיפוש של העמודים.

דוגמה:

```json
{
  "fredi-arnot": {
    "1": "אורי",
    "3": ["אורנוס", "ארון אורנוס"],
    "12": {
      "model": "בלינסיאגה",
      "aliases": ["בלנסיאגה", "balenciaga"],
      "terms": "ארון דגם בלינסיאגה"
    }
  },
  "komotayim": {
    "2": "נוגה כפולה"
  }
}
```

המפתח הראשון הוא `id` מתוך `catalogs.config.json`, והמפתח הפנימי הוא מספר העמוד. אחרי עריכה מספיק להריץ שוב המרה/רענון OCR. גם אם התמונות כבר קיימות והקטלוג מדולג, הטקסט הידני מתמזג מחדש לתוך `catalogs.search.js`.

---

## שיפור איכות ומהירות – מה שיניתי

ההמרה עכשיו משופרת בכמה נקודות:

- רינדור PDF ב־DPI גבוה יותר.
- רוחב/גובה מקסימלי גדולים יותר.
- ברירת המחדל היא WebP, כדי להקטין משקל בלי לוותר על חדות.
- תמונות ממוזערות גדולות מספיק לתצוגה יפה, אבל קלות לטעינה.
- חידוד עדין אחרי הרינדור, כדי שהעמודים ייראו חד יותר.
- תמיכה באחסון התמונות ב־Cloudflare R2 והגשת האתר עצמו מ־Netlify.

---

## מחיקת קבצי PDF אחרי ההמרה

אחרי שההרצה הסתיימה בהצלחה ויש לך תיקיות כמו:

```text
assets\pages\qualita
assets\pages\komotayim
assets\pages\tbi
```

אפשר למחוק את קבצי ה-PDF מתוך `assets\pdfs`,
כי האתר החדש כבר לא משתמש בהם בכלל.

בהרצות הבאות הסקריפט לא יפיל את ההמרה בגלל PDF חסר אם כבר קיימת תיקיית תמונות תקינה לאותו קטלוג.
הוא פשוט ידלג על ה־PDF החסר, ישמור את התמונות הקיימות, וימשיך לקטלוגים הבאים.

---

## יצירת תיקיית העלאה נקייה לאתר

אם אתה עדיין רוצה להעלות את התמונות יחד עם האתר ל־Netlify, אפשר ליצור תיקייה נקייה שמכילה גם את `assets\pages`.

אם אתה עובד עם Cloudflare R2, השתמש במקום זה ב־`bundle-site-r2.bat`, שמייצר אתר בלי התמונות הכבדות.

ב־Windows לחץ פעמיים על:

```text
bundle-site.bat
```

הסקריפט ייצור:

```text
dist\site-upload
```

מה נכנס לבאנדל:
- דפי האתר: `index.html`
- קבצי העיצוב והפעולה: `styles.css`, `app.js`, `catalog-search.js`, `catalog-snapshot.js`, `tooltip-manager.js`, `brand-logo.js`, `favicon-loader.js`
- קבצי נתוני האתר: `catalogs.generated.js`, `catalogs.search.js`, `wp_logo_data.js`
- כל התמונות שכבר הומרו מתוך `assets\pages` — רק במצב המקומי הרגיל, לא בבאנדל R2

הערה: הפרויקט הזה מיועד כרגע להרצה ותחזוקה ב־Windows, לכן קבצי ההרצה של Mac/Linux הוסרו מהחבילה הנקייה.

מה לא נכנס לבאנדל:
- `assets\pdfs`
- תיקיית `tools`
- קבצי התקנה והמרה
- `.venv`
- `catalogs.config.json`
- README וקבצי עבודה אחרים

כלומר: את התיקייה `dist\site-upload` מעלים לאתר. את שאר תיקיית הפרויקט משאירים אצלך במחשב לצורך עריכה, המרות עתידיות וניהול הקטלוגים.

לבאנדל Netlify שמסתמך על R2:

```bash
python tools/build_deploy_bundle.py --assets-mode r2 --zip --allow-missing-pages
```

אם רוצים להריץ ידנית:

```bash
python tools/build_deploy_bundle.py
```

אפשר לבחור יעד אחר:

```bash
python tools/build_deploy_bundle.py --out dist/my-upload
```

---

## הוספת קטלוג חדש

פותחים את `catalogs.config.json` ומוסיפים אובייקט חדש:

```json
{
  "id": "my-new-catalog",
  "title": "שם הקטלוג",
  "description": "תיאור קצר",
  "category": "קטגוריה",
  "pdf": "assets/pdfs/my-new-catalog.pdf"
}
```

חשוב:
- `id` עדיף באנגלית
- בלי רווחים
- עדיף רק אותיות, מספרים ומקפים

אחרי ששומרים, מריצים שוב את ההמרה.
רק הקטלוג החדש יומר; קטלוגים שכבר יש להם תיקיית תמונות תקינה בתוך `assets/pages` ידולגו.

---

## פקודות ידניות למי שמעדיף טרמינל

מתיקיית האתר:

```bash
py -3 -m venv .venv
.venv\Scripts\activate
python -m pip install -r tools\requirements.txt
python tools\build_catalogs.py
python -m http.server 8080
```

### דוגמה להמרת WebP מומלצת:

```bash
python tools\build_catalogs.py --format jpg --dpi 220 --max-width 2800 --max-height 2800 --thumb-size 420 --quality 94 --thumb-quality 88 --sharpen 1.0 --ocr auto --ocr-lang heb+eng
```

### להכריח המרה מחדש של כל הקטלוגים שקובץ ה-PDF שלהם קיים:

```bash
python tools\build_catalogs.py --force
```

אפשר לשלב את `--force` עם כל הגדרות האיכות, למשל `--format webp`, `--format jpg`, `--format png` או DPI גבוה יותר.

### דוגמה להמרת PNG מקסימלית:

```bash
python tools\build_catalogs.py --format png --dpi 240 --max-width 3200 --max-height 3200 --thumb-size 460
```

---

## מבנה חשוב של הקבצים

```text
index.html
styles.css
app.js
catalogs.config.json          <-- כאן עורכים רשימת קטלוגים
catalogs.generated.js         <-- נוצר אוטומטית, לא לערוך ידנית
catalog-assets-config.js      <-- כתובת בסיס לתמונות ב-R2, אם משתמשים באחסון חיצוני
convert-catalogs.bat          <-- המרה מצטברת ל-WebP: מדלג על מה שכבר הומר
convert-catalogs-force.bat    <-- המרה מחדש בכוח לכל PDF שקיים
build-r2-assets.bat           <-- הכנת תיקיית תמונות ל-R2
bundle-site-r2.bat            <-- יצירת באנדל Netlify בלי התמונות הכבדות
assets/
  brand/
    logo-placeholder.svg
  pdfs/                       <-- כאן שמים PDF לפני ההמרה
  pages/                      <-- כאן נוצרות התמונות, והאתר עובד מהן
tools/
  build_catalogs.py
  render_pdf_catalog.py
  requirements.txt
```

---

## תקלות נפוצות

### `py` לא מזוהה

צריך להתקין Python 3 ל-Windows.
אחרי ההתקנה לסגור ולפתוח שוב חלון פקודות.

### `No module named fitz`

לא הורצה ההתקנה או שהסביבה המקומית לא פעילה.
פשוט הרץ שוב:

```text
setup-windows.bat
```

### `PDF not found`

אם כבר קיימת תיקיית תמונות תקינה ב־`assets\pages`, זה לא אמור לעצור את ההרצה — הסקריפט ישמור את התמונות הקיימות וידלג על ה־PDF החסר.

אם אין גם PDF וגם אין תיקיית תמונות תקינה, שם הקובץ ב־`catalogs.config.json` כנראה לא תואם לקובץ האמיתי ב־`assets\pdfs`, או שהקטלוג עדיין לא הומר.

### התמונות לא מופיעות באתר

בדוק שקיימים קבצים כמו:

```text
assets\pages\qualita\page-001.webp
```

או, בפרויקטים ישנים יותר:

```text
assets\pages\qualita\page-001.jpg
```

אם עובדים עם R2, בדוק גם ש־`catalog-assets-config.js` מכיל כתובת ציבורית אמיתית, לא S3 API, ושהקובץ נפתח ישירות בדפדפן בכתובת כמו:

```text
https://PUBLIC-R2-URL/assets/pages/qualita/page-001.webp
```

---

## טיפ פרקטי

אם אתה רוצה יחס טוב בין איכות למשקל – תישאר עם `convert-catalogs.bat`, שמייצר WebP.
אם אתה צריך תאימות ישנה במיוחד – השתמש ב־`convert-catalogs-jpg.bat`.
אם אתה רוצה מקסימום איכות בלי להתחשב במשקל – `convert-catalogs-png.bat`.

במילים פשוטות: WebP הוא הסוס עבודה, JPG הוא הגיבוי, PNG הוא הטנק.

---

## יצירת קשר במייל ללא טופס באתר

בסוף הדף הראשי, בתוך הפוטר ליד שורת הזכויות, מוצג רק כפתור **צור קשר**. הכפתור סגור כברירת מחדל, ולחיצה עליו פותחת מתחתיו את אפשרות שליחת המייל.

אין טופס באתר, אין שליחת AJAX, אין `mailto:` ואין תלות במנגנון טפסים של האחסון. כפתור **פתיחת Gmail לשליחה** ב־`index.html` פותח כתובת Gmail Compose ישירה עם כתובת החנות מוכנה מראש בתוך הקישור בלבד, בלי להציג את כתובת המייל על המסך.

הקישור משתמש ב־`tf=cm`, כדי לפתוח את חלון הכתיבה של Gmail בצורה קרובה יותר לברירת המחדל הרגילה של Gmail. בפועל, Gmail עדיין יכול לכבד העדפות חשבון/דפדפן של המשתמש, למשל אם אצלו הוגדר שחלון כתיבה נפתח תמיד במסך מלא.

אם צריך להחליף בעתיד את כתובת המייל, משנים אותה רק בתוך קישור Gmail שב־`index.html`.

---

## העלאה יציבה ל־R2: retry, resume ו־remote אמיתי

הסקריפט `upload-r2-assets-wrangler.bat` שודרג כדי להעלות בצורה בטוחה יותר:

- משתמש תמיד ב־`--remote`, כדי להעלות ל־R2 האמיתי בענן ולא לאחסון מקומי של Wrangler.
- מנסה כל קובץ שוב במקרה של נפילת רשת זמנית.
- שומר התקדמות בקובץ:

```text
  dist\r2-upload-state.json
```

- שומר קבצים שנכשלו בקובץ:

```text
  dist\r2-upload-failed.txt
```

אם באמצע ההעלאה יש שגיאת רשת או Wrangler קורס על קובץ מסוים, לא צריך להתחיל הכול מחדש. מריצים:

```text
retry-r2-failed-uploads.bat bargig-catalog
```

או:

```text
upload-r2-assets-wrangler.bat bargig-catalog --failed-only
```

אם רוצים להעלות הכול מחדש בכוח, גם קבצים שכבר סומנו כהועלו בהצלחה:

```text
upload-r2-assets-wrangler.bat bargig-catalog --force
```

אם כבר הגדרת CORS ידנית ב־Cloudflare, אין צורך להגדיר אותו שוב. אם בכל זאת רוצים שהסקריפט ידרוס ויגדיר CORS מתוך הקובץ `r2-cors-wrangler.json`, מריצים:

```text
upload-r2-assets-wrangler.bat bargig-catalog --set-cors
```

