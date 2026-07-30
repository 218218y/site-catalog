# ארכיטקטורת הממשק וחבילות המסלולים

מסמך זה מגדיר את גבולות האחריות של קוד הממשק. המטרה אינה לחלק קבצים לפי מספר שורות, אלא לוודא שכל מסלול מוריד ומפעיל רק את היכולות שהוא צריך, ושכל Feature מתקשר עם Feature אחר דרך חוזה קטן ויציב במקום דרך state או DOM פנימיים.

## עקרונות קבועים

- עורכים JavaScript תחת `src/js`, נקודות כניסה תחת `src/entries`, ו־CSS תחת `src/css`.
- `app-catalog.js`, `app-favorites.js`, `app-viewer.js` וקובצי `styles-*.css` הם תוצרים אוטומטיים.
- אין producer או consumer ל־`app.js`; כלי הבנייה אינו מבצע עוד cleanup חוזר של artifact שכבר פרש. כל מסלול טוען ES Module ייעודי באמצעות `type="module"`.
- כל קובץ runtime יישומי תחת `src/js` הוא ES Module אמיתי. כל Route מתחיל ב־entrypoint קטן תחת `src/entries`, ו־esbuild אורז את גרף ה־imports ל־ES Module יחיד וייעודי למסלול. התוצר נטען ישירות באמצעות `type="module"`, ללא מעטפת IIFE ברמת ה־bundle וללא loader תאימות. IIFE מקומי המשמש לאתחול ערך פנימי אינו שכבת תאימות ואינו משנה את גבול המודול. נכסי bootstrap עצמאיים ונתונים generated שאינם חלק מגרף ה־Feature מתועדים ומאומתים בנפרד ב־`docs/compatibility-artifact-inventory.md`; הם אינם aliases של runtime שפרש.
- Feature אינו קורא state או DOM שבבעלות Feature אחר. תקשורת חוצת־Features נעשית דרך `registerFeatureInterface()` ו־`getFeatureInterface()`.
- כל שם Feature וכל API שלו מוגדרים במפת `FeatureRegistry`; אין registry פתוח של strings ואין חוזה־על שבו כל הפעולות אופציונליות.
- state, הפניות DOM ורישום אירועים נמצאים בבעלות תחומית מפורשת.
- `80-app-shell.js` הוא composition root: הוא מתאם lifecycle ברמת המסמך דרך Feature APIs בלבד.
- `90-bootstrap.js` הוא גבול startup זעיר בלבד: פונקציית `init()` אחת שמאצילה ל־`app-shell`, ללא orchestration וללא לוגיקה עסקית.
- כל קובצי `src/js/**/*.js` נבדקים ב־TypeScript `strict`, כולל `noImplicitAny`; חריגה מקומית מחייבת טיפוס אמיתי ולא `any` או השתקה גורפת.
- קובץ חדש מוצדק רק כאשר קיימים אחריות עצמאית, lifecycle או state משלו, ויכולת לבדוק את החוזה בנפרד.

## מטריצת Route bundles

| מסלול | JavaScript | CSS | יכולות עיקריות | אינו כולל |
|---|---|---|---|---|
| בית וקטלוג | `app-catalog.js` | `styles-catalog.css` | ניווט, כרטיסי קטלוג, חיפוש, שמירת מועדפים | state וקוד Viewer, סביבת העבודה של המועדפים |
| מועדפים | `app-favorites.js` | `styles-favorites.css` | קטלוג, חיפוש, סביבת עבודה ושיתוף מועדפים | state וקוד Viewer |
| Viewer | `app-viewer.js` | `styles-viewer.css` | חיפוש בתוך Viewer, שמירת מועדפים, Viewer ומחוות; וגם יעדי המעבר בית/קטלוג/מועדפים | — |
| משפטי/SEO | `styles.css` | ללא JavaScript יישומי | מעטפת סטטית | כל Features האינטראקטיביים |

היעדר Feature נבדק לפי ה־metafile של esbuild ולפי רשימת גרף המקור החתומה בראש התוצר, ולא באמצעות flag בלבד. לדוגמה, `app-catalog.js` נכשל בבנייה אם `16-viewer-state.js` או `60-viewer.js` מופיעים בו. חבילת Viewer היא חריג מכוון: היא כוללת את `catalog-grid` ואת `favorites-workspace`, מפני שהחלפת מסמך מוציאה את הדפדפן ממצב מסך מלא ולכן המעבר מה־Viewer למסלולים האלה חייב להישאר בתוך המסמך הנוכחי.

## בעלות על state ו־DOM

| תחום | state | DOM owner | אחריות |
|---|---|---|---|
| ניווט ומעטפת | `navigationState` | `shellElements` | Route, קטלוג פעיל, היסטוריה ורכיבי מעטפת |
| קטלוג | `catalogState` | `catalogElements` | Grid, קטגוריות, תצוגת פרטי קטלוג ו־layout |
| חיפוש | `searchState` | `searchElements` | פאנלים, scope, preload ומצב תוצאות |
| מועדפים | `favoritesState` | `favoritesElements` | Workspace, בחירה, סינון, הערות ו־drag |
| בירור משותף | `inquiryState` | `inquiryElements` | lifecycle, focus, תוכן ופעולות של חלון הבירור |
| Viewer | `viewerState` | `viewerElements` | lifecycle, fullscreen, zoom, pan, gestures ו־UI |
| שירותים משותפים | `catalogAssetState`, `uiRuntime` | ללא DOM owner ייעודי | cache תמונות ומשוב גלובלי קטן |

`tools/check_frontend_contracts.py` אוסף את כל מאפייני ה־state וה־DOM, ודוחה:

- שימוש ב־`state.*` או `els.*` המונוליטיים הישנים.
- property שאינו מוכר בחוזה של בעל התחום.
- property או DOM reference שמוגדרים אצל שני בעלים.
- כל גישה ישירה ל־state או ל־DOM owner מחוץ לרשימת קובצי המימוש המאושרת של אותו תחום.
- Feature חסר, כפול או בעל שם שאינו קיים ב־`FeatureRegistry`.
- `jsconfig.json` שאינו בודק את כל `src/js` ב־strict מלא.
- Bootstrap שמכיל יותר מגבול startup מינימלי.

החריג אינו "קובץ אחר באותו bundle": רק קובצי owner מפורשים רשאים לגעת במבנה mutable. כל תלות בתוך גרף היישום של `src/js` מופיעה כ־`import` מפורש, ושאר הקוד משתמש בחוזה Feature ממוקד. גבולות bootstrap חיצוניים עוברים דרך owner יחיד ומתועדים ב־inventory; אין עוד scope לקסיקלי משותף שמאפשר לסמל לא־מיובא להיראות במקרה.

## Feature Interfaces

החוזה הקנוני מוגדר ב־`src/js/05-app-contracts.js` כמפת `FeatureRegistry`. כל מפתח מצביע ל־API נפרד ומדויק, לדוגמה:

- `navigation`: קטלוג ועמוד פעילים, מקור Viewer, Route shell ושחזור scroll.
- `catalog-grid`: אתחול Grid, פתיחת קטלוג, רענון layout וסנכרון hash.
- `catalog-navigation` ו־`catalog-detail`: פעולות ממוקדות שהחיפוש והמעטפת רשאים לבקש מהקטלוג.
- `favorites`: store, מצב Viewer של מועדפים וסנכרון הכפתורים.
- `favorites-workspace`: רינדור, סינון, שיתוף וטיפול בעורך הערה.
- `inquiry`: חלון הבירור המשותף, כולל focus trap, שיתוף, העתקה ונעילת המסמך.
- `search`: סגירת שכבות חיפוש, חיפוש Viewer ומצב Mobile search.
- `viewer`: פתיחה, סגירה, מעבר עמוד, lifecycle וממשק UI מצומצם.
- `app-shell`: orchestration ברמת המסמך בלבד.

`registerFeatureInterface()` ו־`getFeatureInterface()` הם generic לפי `keyof FeatureRegistry`. לכן שם שגוי, פעולה שאינה שייכת ל־Feature או רישום API חסר נכשלים כבר ב־`check:types`.

כללים:

1. אסור לקרוא משתנה mutable או DOM פנימי של Feature אחר.
2. קריאה חוצת־Features עוברת דרך API קטן המוגדר ב־`FeatureRegistry`; פעולה שאינה בחוזה אינה "נוספת זמנית" באמצעות optional chaining.
3. Feature שאינו נטען במסלול מסוים יכול להחזיר `null`, אך API של Feature שנרשם חייב להתאים במלואו לחוזה שלו.
4. רישום כפול, שם לא מוכר או Feature חסר נכשל בשער הארכיטקטורה.
5. Interface נרשם כ־frozen object כדי למנוע החלפה שקטה בזמן ריצה.
6. אירועים נרשמים פעם אחת בלבד באמצעות `bindFeatureEventsOnce()` ורק אחרי binder שהסתיים בהצלחה.

## בניית ES Modules וגרפי מסלולים

- `esbuild` הוא `devDependency` ישיר ומקובע בדיוק ל־`0.28.1`; גם `package-lock.json` מקבע את חבילת הליבה ואת הבינארי הפלטפורמי. `tools/build_frontend_esbuild.mjs` מסרב לעבוד עם גרסה אחרת.
- נקודות הכניסה הן `src/entries/catalog.js`, `src/entries/favorites.js` ו־`src/entries/viewer.js`. הן מכילות imports סטטיים בלבד ואינן מחזיקות state או לוגיקה עסקית.
- `tools/build_frontend_assets.py` מחזיק manifest נבדק לכל Route. לאחר bundling הוא מפריד בין קובצי מקור פיזיים לבין קלטי compiler וירטואליים כגון `<define:...>`. הגרף הפיזי מושווה במדויק ל־manifest המאושר, וקלט וירטואלי שאינו ברשימת ה־defines המוכרת מכשיל את הבנייה.
- שמות התוצרים נשמרים: `app-catalog.js`, `app-favorites.js`, `app-viewer.js`. הפורמט הוא `esm`, וה־HTML טוען אותם באמצעות `<script type="module">`; אין מעטפת IIFE סביב התוצר ואין loader היסטורי. בדיקת החוזה בוחנת את המבנה החיצוני בלבד כדי לא לפסול ביטויי אתחול מקומיים תקינים.
- route capability flags מוזרקים בזמן build דרך `01-route-capabilities.js`, אבל הם אינם תחליף ל־tree shaking: Feature שאינו במסלול חייב להיעדר פיזית מהגרף.
- `dynamic import` אינו מאושר כרגע: אין בפרויקט יכולת אופציונלית כבדה שמצדיקה chunk נוסף, נתיב פריסה נוסף ומסלול כשל נוסף. `catalog-snapshot.js` קטן ומיובא רק מה־adapter של Viewer, ללא script עצמאי, ללא בקשת רשת נוספת וללא כניסה לגרפי Catalog/Favorites. `catalog` ו־`favorites` כבר מפוצלים לפי מסלול, ואילו Search, Catalog Grid ו־Favorites Workspace ב־Viewer נשארים eager באותו document כדי שמעבר בזמן fullscreen לא יגרום ליציאה ממסך מלא.
- גרף ה־imports נבדק באמצעות strongly connected components. מחזור בין תחומים או בין Features אסור. המחזור היחיד המאושר הוא בתוך תת־המודולים הקוהרנטיים של Viewer, שבהם אין הפעלת lifecycle ברמת top-level; TypeScript, esbuild ובדיקות הדפדפן משמשים יחד כשער נגד TDZ או סדר אתחול שגוי.
- `02-dom-contracts.js`, `03-runtime-context.js` ו־`17-catalog-asset-urls.js` הם owners נמוכים ועצמאיים שנועדו למנוע תלות הפוכה בין Navigation, Shared UI, Telemetry ו־App Shell. Telemetry מקבלת callback לשחזור תמונה דרך dependency injection, ו־Navigation מבקש render מחדש דרך חוזה `app-shell` במקום לייבא את ה־composition root.

## מודולי JavaScript

| מודול | אחריות |
|---|---|
| `00-navigation.js` | כתובות, history, ניווט פנימי ומטא־דאטה |
| `01-route-capabilities.js` | יכולות Route מוזרקות בזמן build ומאומתות כקלט compiler וירטואלי |
| `02-dom-contracts.js` | lookup טיפוסי וחוזי DOM משותפים |
| `03-runtime-context.js` | נתוני bootstrap לקריאה בלבד: קטלוגים, חיפוש ו־routes |
| `05-app-contracts.js` | טיפוסי JSDoc וחוזי Feature משותפים |
| `10-app-state.js` | שירותים route-neutral ורישום Feature Interfaces |
| `11-navigation-state.js` | מצב ניווט ו־DOM של מעטפת |
| `12-catalog-state.js` | מצב ו־DOM של קטלוג |
| `13-search-state.js` | מצב ו־DOM של חיפוש |
| `14-favorites-state.js` | מצב ו־DOM של מועדפים |
| `15-telemetry.js` | ניטור שומר פרטיות |
| `16-viewer-state.js` | מצב ו־DOM של Viewer בלבד |
| `17-catalog-asset-urls.js` | יצירת כתובות נכסי קטלוג וגרסאות cache |
| `18-navigation-feature.js` | facade טיפוסי לבעלות ניווט ו־Route shell |
| `19-shared-pure.js` | מדיניות טהורה משותפת, ללא DOM או state |
| `20-shared-ui.js` | שירותי UI משותפים שאינם בבעלות Feature יחיד |
| `29-favorites-portability.js` | codec ומדיניות טהורה לייבוא, מיזוג ושיתוף מועדפים |
| `30-favorites-share.js` | store ושיתוף בסיסי של מועדפים |
| `31-viewer-share.js` | שיתוף וצילום שתלויים ב־Viewer |
| `32-shared-inquiry.js` | חלון הבירור המשותף ל־Viewer ולמועדפים |
| `35-favorites-workspace.js` | סביבת העבודה של דף המועדפים |
| `39-search-catalog-domain.js` | מדיניות טהורה ל־layout ולמעברי Search/Catalog/Viewer |
| `40-catalog-grid.js` | Grid, קטגוריות ותצוגת פרטי קטלוג |
| `50-search-ui.js` | לקוח Worker וממשקי החיפוש |
| `52-viewer-session.js` | state machine של Viewer ו־Fullscreen |
| `53-viewer-image.js` | טעינת תמונת Viewer והחלפת רזולוציה |
| `54-viewer-geometry.js` | fit, zoom, pan ונקודות מוקד |
| `56-viewer-shell.js` | toolbar, page rail ומעטפת Viewer |
| `58-viewer-navigation.js` | גלגלת, touchpad ומעבר עמוד |
| `60-viewer.js` | lifecycle והרכבת ממשק Viewer |
| `62-viewer-actions.js` | תפריט הפעולות הקומפקטי של ה־Viewer |
| `65-viewer-onboarding.js` | הדרכת כניסה |
| `70-viewer-input.js` | pointer, pinch, pan, wheel ו־double tap |
| `80-app-shell.js` | composition root ותיאום lifecycle דרך Feature APIs |
| `90-bootstrap.js` | startup מינימלי שמאציל ל־`app-shell` |

## אסטרטגיית בדיקות התנהגות

בדיקות התנהגות אינן קוראות גוף פונקציה מתוך קובץ מקור ואינן מפעילות אותו באמצעות `new Function`, `eval` או `vm`. קובץ המקור של הייצור הוא מקור האמת היחיד.

- לוגיקה טהורה נמצאת במודולי domain כגון `19-shared-pure.js`, `29-favorites-portability.js` ו־`39-search-catalog-domain.js`. ה־owners של ה־UI מאצילים אליהם במקום לשכפל אלגוריתם בבדיקה.
- כאשר owner ותיק עדיין תלוי ב־DOM או ב־state, הוא רשאי לפרסם API בדיקה קטן בתוך גבול `TEST-ONLY EXPORTS`. `tests/frontend_test_module.js` טוען את קובץ המקור האמיתי ומקבל את ה־API הזה; ה־builder מסיר את הגבול כולו מכל bundle ייצור.
- source-text tests נשארים רק לחוזים שבהם מבנה הקוד הוא המוצר הנבדק: manifest, היעדר Feature ממסלול, markup/CSS נדרש, CSP או wiring של build. הם אינם מחלצים או מבצעים לוגיקה עסקית.
- תוצרי `app-*.js` נבדקים רק כחוזי build/route: banner, entrypoint, מודולים נדרשים או אסורים והיעדר runtime היסטורי. בדיקות מימוש אינן מחפשות פונקציות או הצהרות בתוך פלט esbuild, משום ש־`minifySyntax` רשאי לשנות `const` ל־`var`, ערכי boolean ל־`!0` וצורות שקולות נוספות.
- נרמול החיפוש נבדק מול `tests/fixtures/search_normalization_vectors.json`, אותו corpus שמורץ גם נגד Python Compiler וגם נגד Worker JavaScript. שינוי ב־Unicode, באותיות סופיות, במקף עברי, ב־quotes או ב־loose matching אינו יכול לסטות בין build ל־runtime.
- seams בין Features נבדקים דרך ports מחייבים. לדוגמה, `Search` אינו רשאי לדווח הצלחה כאשר `Catalog Grid` או `Viewer` חסרים; אינטגרציה נדרשת נפתרת באמצעות `requireFeatureInterface()` ונכשלת בקול ברור.
- `tools/check_frontend_contracts.py` דוחה חזרה ל־dynamic source execution ומוודא ש־test-only exports אינם מגיעים ל־`app-catalog.js`, `app-favorites.js` או `app-viewer.js`.

תוצאה רצויה: שינוי שם מקומי, פיצול פונקציה או שינוי אינדנטציה אינם שוברים בדיקת התנהגות; שינוי API, תוצאה או אינטגרציה כן שוברים אותה.

## Audit של orchestration

בשלב הניקוי נבדקו פונקציות orchestration ארוכות ב־Search, Favorites, Viewer ו־App Shell. לא בוצע פיצול לפי מספר שורות בלבד: הפונקציות שנשארו ארוכות מרכזות lifecycle קוהרנטי, והוצאת wrappers ללא owner עצמאי הייתה מוסיפה indirection בלי להקטין coupling. פיצול עתידי נדרש רק כאשר שינוי התנהגותי יוצר boundary בעל state, חוזה או בדיקות עצמאיים.

## שכבות CSS וטעינה לפי מסלול

CSS נשמר בשכבות אחריות קיימות, אך builder מרכיב manifest שונה לכל Route. אין לפצל selector רק כדי להקטין קובץ; שכבה נכללת במסלול כאשר הרכיבים שלה באמת קיימים בו.

- `styles.css`: foundation, shell, media, footer, accessibility ו־SEO.
- `styles-catalog.css`: מוסיף Grid ותיקוני קטלוג.
- `styles-favorites.css`: מוסיף Workspace, חלון בירור משותף ו־favorites routing.
- `styles-viewer.css`: מוסיף Viewer, onboarding, חלון בירור משותף ויכולות עיצוב למסלולי המעבר במסך מלא.

סדר ה־cascade הוא חלק מהחוזה ונבדק על ידי builder. כל התוכן הקיים נעטף בשכבה יחידה בשם `bargig.application`. זהו מעבר מכוון ובטוח: כל ה־selectors נשארים באותה שכבה, ולכן specificity וסדר המקור היחסי נשמרים בדיוק. אין פיזור של `@layer` בקובצי המקור; ה־builder הוא owner יחיד של גבול השכבה, וניתן יהיה לפצל בעתיד לשכבות נוספות רק בפרוסה עם visual regression מלאה.

ערכי stacking גלובליים אינם נכתבים כמספרים אקראיים. `00-foundation.css` מגדיר חוזה `--z-*` סמנטי עבור header, popover, dialog, tour, toast, tooltip ושאר משטחים חוצי־רכיבים. בתוך stacking context מקומי מותר להשתמש רק בערכים קטנים מ־20. `tools/check_frontend_contracts.py` מכשיל מספר `z-index` גלובלי חדש שאינו עובר דרך token.

הערות review פנימיות נשארות בקובצי המקור ואינן נשלחות לדפדפן; ה־builder שומר רק banner, גבולות source והערות רישיון `/*! ... */`. קובצי המקור אינם מועלים לפריסה; רק התוצרים החתומים ב־hash נשלחים. חוזי JSDoc נשארים מלאים במקור לצורך `checkJs`; esbuild מנתח אותם כמטא־דאטה מקור ואינו מעביר הערות type-only לתוצר, תוך שמירת הערות רישיון לפי `legalComments: "inline"`.

## שערי Build ו־CI

שלב הממשק אינו מסתמך על בדיקה אחת:

1. `python tools/build_frontend_assets.py --check` — דטרמיניזם ועדכניות התוצרים.
2. `python tools/check_frontend_contracts.py` — בעלות state/DOM וגבולות Route/Feature.
3. `tsc -p jsconfig.json --noEmit` — strict מלא על כל `src/js/**/*.js`, globals מוכרזים, DOM מדויק ו־Feature Registry ממופה.
4. `node tools/check_frontend_runtime_symbols.js` — כל Route bundle נבדק לסמלים בלתי־פתורים. כך קריאה ל־Viewer מתוך חבילת הבית אינה יכולה להסתתר מאחורי תנאי runtime.
5. בדיקות JavaScript — unit tests שמייבאים מודולי ייצור, בדיקות integration ל־Feature ports, ו־source-text רק לחוזים מבניים.
6. בדיקות Python — יצירת דפים, fingerprinting, פריסה ותקציבי גודל.
7. Playwright — מסעות דפדפן, שגיאות runtime וטעינה לפי מסלול.

שגיאות מבנה של נתוני הקטלוג נתפסות בנוסף על ידי JSON Schemas וה־Catalog Compiler לפני כתיבת תוצרי האתר.

## תקציבי גודל

`performance-budgets.json` מגדיר תקציב נפרד לכל Route ולכל stylesheet, עם דרישת headroom של לפחות 15%. התקציב אינו רק תקרה קשיחה: build נכשל גם כאשר תוצר מתקרב מדי לתקרה. כל Feature חדש חייב להיכנס למסלול שבו הוא נדרש בלבד; העלאת תקרה דורשת נימוק ומדידה, לא רק שינוי מספר.

## רשימת בדיקה לפני שינוי

1. לזהות את בעל ה־state, ה־DOM וה־lifecycle לפני עריכה.
2. להשתמש ב־API המדויק של ה־Feature מתוך `FeatureRegistry` במקום לקרוא internals של Feature אחר.
3. כאשר נדרשת פעולה חדשה, להוסיף אותה קודם לחוזה ה־Feature הנכון ולמימוש owner יחיד; לא לעקוף עם string, property דינמי או `any`.
4. להוסיף listener ליד ה־Feature ולחבר אותו דרך `attachEvents`.
5. לא לערוך generated bundles ישירות.
6. להריץ `npm run build:frontend`, `npm run check:types`, `npm run check:frontend-contracts` ו־`npm run check:runtime-symbols`.
7. להריץ את בדיקות JavaScript ו־Python.
8. בשינוי מסלול או manifest, לבדוק את ה־HTML הממופה בבאנדל ולא רק את קובצי המקור.
9. בשינוי חזותי או אינטראקטיבי, להריץ Playwright במחשב וב־viewport צר.
10. אין לפצל מודול רק בגלל מספר השורות; פיצול מוצדק כאשר הוא מוריד coupling או מאפשר השמטת Feature ממסלול.
