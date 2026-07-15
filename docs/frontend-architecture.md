# ארכיטקטורת הממשק

מסמך זה מגדיר את גבולות האחריות של קוד הממשק. המטרה היא למנוע חזרה הדרגתית ל־`app.js` ול־`styles.css` כקובצי מקור ענקיים, בלי להוסיף לדפדפן בקשות רשת או מערכת build כבדה.

## עקרונות קבועים

- עורכים רק קבצים תחת `src/js` ו־`src/css`.
- `app.js` ו־`styles.css` הם תוצרים אוטומטיים ולא מקור לעריכה.
- הדפדפן מקבל קובץ JavaScript אחד וקובץ CSS אחד.
- כל קוד ה־JavaScript רץ בתוך scope פרטי וב־strict mode; אין להוסיף פונקציות יישום ל־`window`.
- אירועים נרשמים במודול שמחזיק בפיצ'ר, לא בקובץ bootstrap מרכזי.
- `90-bootstrap.js` מחבר פיצ'רים, מכין נתיבים ומאתחל את האפליקציה; הוא אינו אמור להכיל לוגיקת ממשק מפורטת.
- סדר מודולי CSS הוא חלק מהחוזה. אין לשנות מספרי קבצים או להעביר כללים בין שכבות בלי לבדוק את ה־cascade.

## מודולי JavaScript

| מודול | אחריות |
|---|---|
| `00-navigation.js` | כתובות, היסטוריה, ניווט בתוך אותו מסמך ומטא־דאטה |
| `10-app-state.js` | קבועים, state, הפניות DOM ורישום אירועים חד־פעמי |
| `20-shared-ui.js` | תמונות, placeholders, הודעות, tooltips וכלי UI משותפים |
| `30-favorites-share.js` | מועדפים, העברת רשימה ושיתוף קישורים |
| `40-catalog-grid.js` | רשימת קטלוגים, קטגוריות ותצוגה מקדימה |
| `50-search-ui.js` | טעינת אינדקס, חיפוש ראשי וחיפוש בצופה |
| `60-viewer.js` | מחזור חיי הצופה, טעינת עמוד, פריסה, סרגלים ומצב zoom |
| `65-viewer-onboarding.js` | סיור הכניסה, spotlight, focus וניקוי מצב ההדרכה |
| `70-viewer-input.js` | pointer, pan, pinch, wheel, double tap ומחוות |
| `90-bootstrap.js` | composition root, הכנת route ואתחול בלבד |

### כיוון התלויות

המספור מייצג סדר טעינה ותלות. מודול מאוחר רשאי להשתמש בפונקציות ממודול מוקדם. תלות הפוכה צריכה להישאר חריגה ומפורשת. קוד של פיצ'ר חדש צריך להיכנס למודול הקיים המתאים; קובץ חדש מוצדק רק כאשר קיימת אחריות עצמאית וברורה, lifecycle משלה וקבוצת בדיקות משלה.

## רישום אירועים

כל פיצ'ר מספק פונקציית binding אחת, לדוגמה:

```js
function attachSearchUiEvents() {
  // כל מאזיני החיפוש נמצאים כאן.
}
```

`attachEvents()` מפעיל את ה־binders באמצעות `bindFeatureEventsOnce`. הרישום מסומן כהושלם רק לאחר שה־binder הסתיים בלי שגיאה. כך אתחול חוזר אינו מכפיל מאזינים, וכשל באמצע אינו משאיר פיצ'ר מסומן בטעות כבריא.

## שכבות CSS

| שכבה | אחריות |
|---|---|
| `00-foundation.css` | tokens, reset, body ומשוב גלובלי |
| `05-viewer-onboarding.css` | עיצוב ההדרכה בלבד |
| `06-shell-components.css` | מעטפת האתר, header, controls ורכיבים משותפים |
| `10-catalog.css` | קטלוגים ותצוגות רשימה |
| `20-viewer.css` | הצופה הקבוע |
| `30-media-components.css` | מדיה ורכיבי תמונה משותפים |
| `40-catalog-refinements.css` | ליטושי קטלוג ממוקדים |
| `50-footer-legal.css` | footer ודפים משפטיים |
| `80-responsive-shell.css` | התאמות viewport, מובייל ונגישות תנועה |
| `85-favorites-routing.css` | מועדפים עצמאיים ומעטפת multi-document |
| `90-visual-polish.css` | placeholders, feedback, empty states ופינישים מאוחרים |

הפיצול שומר את סדר הכללים שהיה קיים לפני ההפרדה. בדיקת הבנייה מוודאת שסדר שמות המודולים עולה ושאין כפילויות במניפסט.

## פקודות תחזוקה

```bat
python tools\build_frontend_assets.py
python tools\build_frontend_assets.py --check
node --check app.js
```

בדיקה מלאה:

```bat
for %f in (tests\*.test.js) do node "%f"
python -m pytest -q
```

## רשימת בדיקה לפני שינוי

1. לזהות את בעל האחריות של ההתנהגות לפני עריכה.
2. להוסיף event listener ליד הפיצ'ר, לא ב־bootstrap.
3. לא לעדכן `app.js` או `styles.css` ידנית.
4. להריץ build ולוודא ש־`--check` עובר.
5. להריץ בדיקות JavaScript ו־Python.
6. לוודא שתיקיית `src` אינה נכללת בבאנדל הפריסה.
7. בשינוי CSS, לבדוק מחשב, מסך צר ו־`prefers-reduced-motion` כאשר רלוונטי.
