# ארכיטקטורת הממשק וחבילות המסלולים

מסמך זה מגדיר את גבולות האחריות של קוד הממשק. המטרה אינה לחלק קבצים לפי מספר שורות, אלא לוודא שכל מסלול מוריד ומפעיל רק את היכולות שהוא צריך, ושכל Feature מתקשר עם Feature אחר דרך חוזה קטן ויציב במקום דרך state או DOM פנימיים.

## עקרונות קבועים

- עורכים רק קבצים תחת `src/js` ו־`src/css`.
- `app-catalog.js`, `app-favorites.js`, `app-viewer.js` וקובצי `styles-*.css` הם תוצרים אוטומטיים.
- `app.js` הוא loader תאימות קטן בלבד. אסור להחזיר אליו קוד יישום מונוליטי.
- כל Route bundle עטוף ב־scope פרטי וב־strict mode.
- Feature אינו קורא state או DOM שבבעלות Feature אחר. תקשורת חוצת־Features נעשית דרך `registerFeatureInterface()` ו־`getFeatureInterface()`.
- state, הפניות DOM ורישום אירועים נמצאים בבעלות תחומית מפורשת.
- `90-bootstrap.js` הוא composition root בלבד: הוא מאתחל Interfaces קיימים ואינו מכיל לוגיקה עסקית של Feature.
- קובץ חדש מוצדק רק כאשר קיימים אחריות עצמאית, lifecycle או state משלו, ויכולת לבדוק את החוזה בנפרד.

## מטריצת Route bundles

| מסלול | JavaScript | CSS | יכולות עיקריות | אינו כולל |
|---|---|---|---|---|
| בית וקטלוג | `app-catalog.js` | `styles-catalog.css` | ניווט, כרטיסי קטלוג, חיפוש, שמירת מועדפים | state וקוד Viewer, סביבת העבודה של המועדפים |
| מועדפים | `app-favorites.js` | `styles-favorites.css` | קטלוג, חיפוש, סביבת עבודה ושיתוף מועדפים | state וקוד Viewer |
| Viewer | `app-viewer.js` | `styles-viewer.css` | חיפוש בתוך Viewer, שמירת מועדפים, Viewer ומחוות | Grid של דף הבית, סביבת העבודה של המועדפים |
| משפטי/SEO | `styles.css` | ללא JavaScript יישומי | מעטפת סטטית | כל Features האינטראקטיביים |

היעדר Feature נבדק לפי רשימת מודולי המקור בתוך התוצר, ולא באמצעות flag בלבד. לדוגמה, `app-catalog.js` נכשל בבנייה אם `16-viewer-state.js` או `60-viewer.js` מופיעים בו.

## בעלות על state ו־DOM

| תחום | state | DOM owner | אחריות |
|---|---|---|---|
| ניווט ומעטפת | `navigationState` | `shellElements` | Route, קטלוג פעיל, היסטוריה ורכיבי מעטפת |
| קטלוג | `catalogState` | `catalogElements` | Grid, קטגוריות, תצוגת פרטי קטלוג ו־layout |
| חיפוש | `searchState` | `searchElements` | פאנלים, scope, preload ומצב תוצאות |
| מועדפים | `favoritesState` | `favoritesElements` | Workspace, בחירה, סינון, הערות ו־drag |
| Viewer | `viewerState` | `viewerElements` | lifecycle, fullscreen, zoom, pan, gestures ו־UI |
| שירותים משותפים | `catalogAssetState`, `uiRuntime` | ללא DOM owner ייעודי | cache תמונות ומשוב גלובלי קטן |

`tools/check_frontend_contracts.py` אוסף את כל מאפייני ה־state וה־DOM, ודוחה:

- שימוש ב־`state.*` או `els.*` המונוליטיים הישנים.
- property שאינו מוכר בחוזה של בעל התחום.
- property או DOM reference שמוגדרים אצל שני בעלים.
- גישה של Viewer ל־`searchState`/`searchElements`, או של חיפוש ל־`viewerState`/`viewerElements`.

## Feature Interfaces

החוזה הבסיסי מוגדר ב־`src/js/05-app-contracts.js`. כל Feature רושם אובייקט immutable בשם יציב. דוגמאות:

- `catalog-grid`: אתחול Grid, פתיחת קטלוג, רענון layout וסנכרון hash.
- `favorites-workspace`: רינדור, סינון, שיתוף וטיפול בעורך הערה.
- `search`: סגירת שכבות חיפוש, חיפוש Viewer ומצב Mobile search.
- `viewer`: פתיחה, סגירה, מעבר עמוד, lifecycle, inquiry וממשק UI מצומצם.

כללים:

1. אסור לייבא או לקרוא משתנה פנימי של Feature אחר.
2. קריאה ל־Feature אופציונלי חייבת לעבור דרך `getFeatureInterface(name)` ולתמוך בכך שאינו נטען במסלול הנוכחי.
3. רישום כפול של אותו שם נכשל מיד.
4. Interface נרשם כ־frozen object כדי למנוע החלפה שקטה בזמן ריצה.
5. אירועים נרשמים פעם אחת בלבד באמצעות `bindFeatureEventsOnce()` ורק אחרי binder שהסתיים בהצלחה.

## מודולי JavaScript

| מודול | אחריות |
|---|---|
| `00-navigation.js` | כתובות, history, ניווט פנימי ומטא־דאטה |
| `05-app-contracts.js` | טיפוסי JSDoc וחוזי Feature משותפים |
| `10-app-state.js` | שירותים route-neutral ורישום Feature Interfaces |
| `11-navigation-state.js` | מצב ניווט ו־DOM של מעטפת |
| `12-catalog-state.js` | מצב ו־DOM של קטלוג |
| `13-search-state.js` | מצב ו־DOM של חיפוש |
| `14-favorites-state.js` | מצב ו־DOM של מועדפים |
| `15-telemetry.js` | ניטור שומר פרטיות |
| `16-viewer-state.js` | מצב ו־DOM של Viewer בלבד |
| `20-shared-ui.js` | שירותי UI משותפים שאינם בבעלות Feature יחיד |
| `30-favorites-share.js` | store ושיתוף בסיסי של מועדפים |
| `31-viewer-share.js` | שיתוף וצילום שתלויים ב־Viewer |
| `35-favorites-workspace.js` | סביבת העבודה של דף המועדפים |
| `40-catalog-grid.js` | Grid, קטגוריות ותצוגת פרטי קטלוג |
| `50-search-ui.js` | לקוח Worker וממשקי החיפוש |
| `52-viewer-session.js` | state machine של Viewer ו־Fullscreen |
| `53-viewer-image.js` | טעינת תמונת Viewer והחלפת רזולוציה |
| `54-viewer-geometry.js` | fit, zoom, pan ונקודות מוקד |
| `56-viewer-shell.js` | toolbar, page rail ומעטפת Viewer |
| `58-viewer-navigation.js` | גלגלת, touchpad ומעבר עמוד |
| `60-viewer.js` | lifecycle והרכבת ממשק Viewer |
| `62-viewer-actions.js` | inquiry ותפריטי פעולות |
| `65-viewer-onboarding.js` | הדרכת כניסה |
| `70-viewer-input.js` | pointer, pinch, pan, wheel ו־double tap |
| `90-bootstrap.js` | composition root בלבד |

## שכבות CSS וטעינה לפי מסלול

CSS נשמר בשכבות אחריות קיימות, אך builder מרכיב manifest שונה לכל Route. אין לפצל selector רק כדי להקטין קובץ; שכבה נכללת במסלול כאשר הרכיבים שלה באמת קיימים בו.

- `styles.css`: foundation, shell, media, footer, accessibility ו־SEO.
- `styles-catalog.css`: מוסיף Grid ותיקוני קטלוג.
- `styles-favorites.css`: מוסיף Workspace ו־favorites routing.
- `styles-viewer.css`: מוסיף Viewer, onboarding ופעולות Viewer.

סדר ה־cascade הוא חלק מהחוזה ונבדק על ידי builder. קובצי המקור אינם מועלים לפריסה; רק התוצרים החתומים ב־hash נשלחים.

## שערי Build ו־CI

שלב הממשק אינו מסתמך על בדיקה אחת:

1. `python tools/build_frontend_assets.py --check` — דטרמיניזם ועדכניות התוצרים.
2. `python tools/check_frontend_contracts.py` — בעלות state/DOM וגבולות Route/Feature.
3. `tsc -p jsconfig.json --noEmit` — חוזי JSDoc, מבני state ושירותי interface.
4. `node tools/check_frontend_runtime_symbols.js` — כל Route bundle נבדק לסמלים בלתי־פתורים. כך קריאה ל־Viewer מתוך חבילת הבית אינה יכולה להסתתר מאחורי תנאי runtime.
5. בדיקות חוזה JavaScript — manifests, HTML routes, event ownership והתנהגות Feature.
6. בדיקות Python — יצירת דפים, fingerprinting, פריסה ותקציבי גודל.
7. Playwright — מסעות דפדפן, שגיאות runtime וטעינה לפי מסלול.

שגיאות מבנה של נתוני הקטלוג נתפסות בנוסף על ידי JSON Schemas וה־Catalog Compiler לפני כתיבת תוצרי האתר.

## תקציבי גודל

`performance-budgets.json` מגדיר תקציב נפרד לכל Route ולכל stylesheet, עם דרישת headroom של לפחות 15%. התקציב אינו רק תקרה קשיחה: build נכשל גם כאשר תוצר מתקרב מדי לתקרה. כל Feature חדש חייב להיכנס למסלול שבו הוא נדרש בלבד; העלאת תקרה דורשת נימוק ומדידה, לא רק שינוי מספר.

## רשימת בדיקה לפני שינוי

1. לזהות את בעל ה־state, ה־DOM וה־lifecycle לפני עריכה.
2. להשתמש ב־Feature Interface במקום לקרוא internals של Feature אחר.
3. להוסיף listener ליד ה־Feature ולחבר אותו דרך `attachEvents`.
4. לא לערוך generated bundles ישירות.
5. להריץ `npm run build:frontend`, `npm run check:types`, `npm run check:frontend-contracts` ו־`npm run check:runtime-symbols`.
6. להריץ את בדיקות JavaScript ו־Python.
7. בשינוי מסלול או manifest, לבדוק את ה־HTML הממופה בבאנדל ולא רק את קובצי המקור.
8. בשינוי חזותי או אינטראקטיבי, להריץ Playwright במחשב וב־viewport צר.
9. אין לפצל מודול רק בגלל מספר השורות; פיצול מוצדק כאשר הוא מוריד coupling או מאפשר השמטת Feature ממסלול.
