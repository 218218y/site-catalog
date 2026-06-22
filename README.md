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
- **JPG באיכות גבוהה**
- תמונות עמודים גדולות
- תמונות ממוזערות גדולות יותר
- תוצאה טובה ונוחה לאתר

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

### 5. אם אתה רוצה איכות עוד יותר גבוהה

לחץ על:

```text
convert-catalogs-jpg.bat
```

זה מייצר JPG עוד יותר חד וכבד יותר.

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

## שיפור איכות – מה שיניתי

ההמרה עכשיו משופרת בכמה נקודות:

- רינדור PDF ב־DPI גבוה יותר.
- רוחב/גובה מקסימלי גדולים יותר.
- איכות JPG גבוהה יותר.
- תמונות ממוזערות גדולות יותר.
- חידוד עדין אחרי הרינדור, כדי שהעמודים ייראו חד יותר.
- ברירת המחדל היא JPG איכותי ולא WebP.

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

אחרי שהקטלוגים הומרו ויש תיקיית `assets\pages`, אפשר ליצור תיקייה נקייה שמכילה רק את מה שצריך להעלות לאתר.

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
- כל התמונות שכבר הומרו מתוך `assets\pages`

הערה: הפרויקט הזה מיועד כרגע להרצה ותחזוקה ב־Windows, לכן קבצי ההרצה של Mac/Linux הוסרו מהחבילה הנקייה.

מה לא נכנס לבאנדל:
- `assets\pdfs`
- תיקיית `tools`
- קבצי התקנה והמרה
- `.venv`
- `catalogs.config.json`
- README וקבצי עבודה אחרים

כלומר: את התיקייה `dist\site-upload` מעלים לאתר. את שאר תיקיית הפרויקט משאירים אצלך במחשב לצורך עריכה, המרות עתידיות וניהול הקטלוגים.

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

### דוגמה להמרת JPG איכותי:

```bash
python tools\build_catalogs.py --format jpg --dpi 220 --max-width 2800 --max-height 2800 --thumb-size 420 --quality 94 --thumb-quality 88 --sharpen 1.0 --ocr auto --ocr-lang heb+eng
```

### להכריח המרה מחדש של כל הקטלוגים שקובץ ה-PDF שלהם קיים:

```bash
python tools\build_catalogs.py --force
```

אפשר לשלב את `--force` עם כל הגדרות האיכות, למשל `--format png` או DPI גבוה יותר.

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
convert-catalogs.bat          <-- המרה מצטברת: מדלג על מה שכבר הומר
convert-catalogs-force.bat    <-- המרה מחדש בכוח לכל PDF שקיים
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
assets\pages\qualita\page-001.jpg
```

או:

```text
assets\pages\qualita\page-001.png
```

אם יש קבצים שם – האתר אמור לעבוד.
אם אין – ההמרה נכשלה או לא הורצה.

---

## טיפ פרקטי

אם אתה רוצה יחס טוב בין איכות למשקל – תישאר עם `convert-catalogs.bat`.
אם אתה רוצה ללכת עד הסוף – `convert-catalogs-png.bat`.

במילים פשוטות: JPG איכותי הוא הסוס עבודה, PNG הוא הטנק.

---

## טופס יצירת קשר ושליחת מייל

בסוף הדף הראשי מוצג כפתור **צור קשר**. לחיצה עליו פותחת טופס, והטופס שולח בקשה ל־Netlify Function בנתיב:

```text
/api/contact
```

השליחה מתבצעת בצד השרת בלבד. מפתח Resend לא נמצא ב־HTML/JS של הדפדפן, ולכן לא נחשף לגולשים.

### מה צריך לפתוח/להגדיר ב־Resend

1. לפתוח חשבון ב־Resend.
2. ליצור API key עם הרשאה לשליחת מיילים. את המפתח רואים פעם אחת בלבד, אז לשמור אותו במקום בטוח.
3. להוסיף ולאמת דומיין לשליחה, עדיף תת־דומיין כמו `mail.your-domain.co.il` או `send.your-domain.co.il`.
4. אחרי אימות הדומיין, אפשר לשלוח מכל כתובת באותו דומיין, למשל `contact@your-domain.co.il`. הכתובת לא חייבת להיות תיבת מייל קיימת, אבל עדיף שתהיה כתובת שאפשר לקבל אליה תשובות.

### הגדרות חובה ב־Netlify

ב־Netlify נכנסים ל־Project configuration → Environment variables ומגדירים משתנים עבור Functions:

```text
RESEND_API_KEY=...              # מפתח API של Resend
CONTACT_FROM_EMAIL=...          # כתובת שולח מדומיין מאומת, למשל contact@your-domain.co.il
CONTACT_FROM_NAME=רהיטי ברגיג   # לא חובה, אבל יפה יותר במייל
CONTACT_TO_EMAIL=bargig218@gmail.com
CONTACT_SITE_NAME=רהיטי ברגיג
```

`CONTACT_TO_EMAIL` מוגדר בקוד כברירת מחדל ל־`bargig218@gmail.com`, אבל עדיף להגדיר אותו גם ב־Netlify כדי שיהיה קל להחליף כתובת בלי לגעת בקוד. אפשר גם כמה נמענים, מופרדים בפסיקים:

```text
CONTACT_TO_EMAIL=first@example.com,second@example.com
```

חשוב: `CONTACT_FROM_EMAIL` חייב להיות כתובת תחת דומיין מאומת ב־Resend. אם משתמשים בכתובת לא מאומתת, Resend יחזיר שגיאה והטופס לא ישלח.

קובץ `.env.example` מצורף כטמפלייט בלבד. לא להכניס אליו מפתח אמיתי אם הקוד עולה לגיט/לאינטרנט.

### בדיקה לפני העלאה

את המראה ואת הפתיחה/סגירה של הטופס אפשר לבדוק גם כאתר סטטי רגיל. את שליחת המייל עצמה בודקים דרך Netlify CLI או אחרי פריסה ל־Netlify, כי `/api/contact` הוא Netlify Function ולא קובץ סטטי רגיל.

בדיקת תחביר מהירה:

```bash
node --check app.js
node --check netlify/functions/contact.js
```

בדיקה מקומית מלאה עם Netlify CLI:

```bash
npm install -g netlify-cli
netlify dev
```

לבדיקה מקומית אמיתית צריך להגדיר משתני סביבה במחשב או דרך Netlify CLI. אפשר להשתמש ב־`.env.example` כתבנית, אבל ליצור קובץ `.env` מקומי שלא מעלים לאתר:

```text
RESEND_API_KEY=...
CONTACT_FROM_EMAIL=contact@your-domain.co.il
CONTACT_FROM_NAME=רהיטי ברגיג
CONTACT_TO_EMAIL=bargig218@gmail.com
CONTACT_SITE_NAME=רהיטי ברגיג
```

### פריסה

הטופס כולל Function תחת:

```text
netlify/functions/contact.js
```

לכן לא מספיק להעלות רק `index.html`, `styles.css` ו־`app.js`. צריך לפרוס גם את `netlify.toml` ואת תיקיית `netlify/functions`.

הדרך המומלצת: חיבור Git ל־Netlify או פריסה דרך Netlify CLI. פריסת Drag & Drop פשוטה מתאימה בעיקר לאתר סטטי; עבור Function עדיף CLI/Git כדי ש־Netlify יזהה ויפרסם את הפונקציה.

סקריפט `bundle-site.bat` מעתיק גם את `netlify.toml` וגם את `netlify/functions` לתיקיית ההעלאה.
