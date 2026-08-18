# ביקורת מודרניזציית בדיקות וכלי איכות — מצב נוכחי

## מטרת מעטפת האיכות

מעטפת האיכות נועדה להגן על invariants והתנהגות בלי לנעול צורת מימוש מקרית. העיקרון המנחה הוא להשתמש בחוזים מבניים כאשר המבנה הוא החוזה, בבדיקות behavior כאשר ההתנהגות היא החוזה, ובבדיקות generated/property כאשר מספר שילובי הקלט גדול מדי לבדיקות דוגמה ידניות.

## 1. חוזים מבניים מבוססי AST

נוספה שכבת AST משותפת. לאחר סגירת המעבר המלא היא מבוססת על ה־API של TypeScript 7 הנעול בפרויקט:

- `tests/helpers/frontend_ast.js` — parser ומלאי מבני לשימוש בדיקות Node.
- `tools/frontend_ast_inventory.js` — גשר JSON בטוח עבור שומר החוזים ב-Python.
- `tests/frontend_ast_inventory_logic.test.js` — מוכיח שהערות ומחרוזות אינן נספרות כ-imports, קריאות או גישות לשדות, וששגיאת תחביר נדחית עם מיקום.

שומר החוזים `tools/check_frontend_contracts.py` משתמש כעת ב-AST עבור imports ו-dynamic imports, רישום Feature interfaces, גבול bootstrap, זליגת globals, בעלות mutable state/DOM, גבולות ES modules וגישות לשדות owners.

הבדיקות המבניות הקריטיות הבאות הועברו ל-AST מלא ואסור להן לחזור ל-`assert.match` או `assert.doesNotMatch` על קוד JavaScript:

- `tests/control_panel_modular_architecture_contract.test.js`
- `tests/viewer_dependency_graph_contract.test.js`
- `tests/viewer_navigation_source_contract.test.js`
- `tests/viewer_state_domains_contract.test.js`

`tests/feature_event_ownership_contract.test.js` משתמש ב-AST עבור JavaScript ומשאיר Regex רק לחוזי CSS, שבהם הטקסט וה-selectors הם החוזה עצמו.

בבסיס שלפני השינוי היו 1,444 assertions מסוג match/doesNotMatch ב-54 קובצי JavaScript. לאחר גל המודרניזציה הנוכחי יש 1,320 assertions ב-53 קבצים: 124 assertions מבניים הוסרו, בלי לבצע המרה עיוורת של חוזי HTML/CSS שבהם הטקסט עצמו הוא החוזה. חוזה נכסי ה-runtime משתמש כעת ב-TypeScript AST וב-constants אמיתיים של כלי ה-Python במקום לקרוא את קוד המימוש שלהם כטקסט, וגם extraction של גופי פונקציות Search באמצעות Regex הוחלף בשיוך AST לפי owner/function.

## 2. Ruff ו-mypy כשערי איכות מלאים לכל כלי הפרויקט

`pyproject.toml` הוא מקור האמת המרכזי לבדיקות Python.

Ruff אוכף שגיאות correctness (`E9`, `F63`, `F7`, `F82`) על `tools` ו-`tests`. כללי formatting ו-import-order נשארים מחוץ לשער בכוונה, כדי שלא לערבב churn סגנוני עם שינויים התנהגותיים.

mypy מופעל עם `disallow_untyped_defs`, `check_untyped_defs`, `no_implicit_optional` ואזהרות על unreachable/ignores מיותרים. לאחר השלמת הסגירה של שכבת הכלים, היעד אינו עוד allowlist של מודולים שעברו migration: `files = ["tools"]` מכניס אוטומטית את כל כלי ה-Python לשער. במצב הנוכחי נבדקים 55 מודולים, כולל compiler/search/SEO, בנייה ופריסה, control panel, telemetry/reporting, R2, כלי התמונות, transaction recovery וכלי ה-offline/bootstrap.

המעבר לכיסוי מלא גם סגר כמה גבולות שהיו קלים לפספס בכיסוי חלקי:

- JSON mappings נקראים פעם אחת, נבדקים ואז מצומצמים לטיפוס הנכון במקום לבצע `get()` כפול שמותיר union עמום;
- transaction journal משתמש במשתנים נפרדים ל-directory entries ול-file entries, ולכן DTO אחד אינו יכול להיטעות כ-DTO אחר;
- נעילת קובץ ופתיחת דוח ממומשות דרך adapters שמוגדרים לפי `sys.platform`, כך ש-typeshed בודק Windows ו-POSIX בלי להתחזות לכך ש-API של פלטפורמה אחת קיים בשנייה;
- frontend bundle validation מחזיר entrypoint מאומת, ולכן `subprocess` לעולם אינו מקבל `None` ברשימת הפקודה;
- SEO route lock נכשל במפורש על תת-קטגוריה יתומה במקום להעביר `None` עמוק יותר ליצירת URL;
- שדות list מתוך npm offline manifest עוברים validation משותף לפני שימוש, במקום להסתמך על `dict[str, object]` בנקודות הצריכה;
- Pillow image handles מצומצמים ל-`Image.Image` לאחר `exif_transpose`, בהתאם לטיפוס האמיתי שממשיך בצינור ההמרה.

זהו כעת חוזה אוטומטי: כלי חדש תחת `tools/` נכנס ל-mypy בלי שינוי תצורה נוסף. `namespace_packages = false` נשאר תואם לאופן ההרצה הקנוני של כלי הפרויקט כ-scripts, ואין `ignore_errors` או suppressions גורפים.

ה-type gate אינו תלוי בפלטפורמת ה-host שעליה במקרה רץ mypy. כל verification מריץ את אותו חוזה פעמיים, עם `--platform linux` ו-`--platform win32` וב-cache נפרד לכל יעד. כך API של typeshed שקיים רק ב-POSIX או רק ב-Windows נכשל כבר ב-CI גם אם ה-CI עצמו רץ על הפלטפורמה השנייה. `python_version = 3.13` נשאר קו השפה המינימלי, ולכן התקנה מקומית על Python 3.14 אינה משנה את חוזה התאימות.

הגרסאות נעולות ב-`tools/requirements-dev.txt`, נבדקות ב-bootstrap של `.venv`, ונוספו כשלבים חובה לפני pytest ב-`tools/verify_project.py`. `.python-version` הוא מקור האמת לקו התאימות המינימלי: CI, Ruff ו-mypy מכוונים לגרסת הבסיס, בעוד launcher ו-doctor מקבלים minor חדש יותר באותו major. ה-stamp של `.venv` הוא JSON versioned שמכיל fingerprint של דרישות/קו התאימות וגם runtime identity; אם ה-runtime שנבחר משתנה, הסביבה נבנית מחדש ולא נעשה ערבוב בין interpreters.

פקודות ייעודיות:

```bash
npm run lint:python
npm run check:python-types
npm run check:python-quality
```

## 3. Project doctor

`tools/project_doctor.py` מבצע אבחון לא-משנה ולא נעצר בכשל הראשון. הוא בודק ומדווח יחד:

- גרסת Python.
- התאמה מדויקת ל-Node שב-`.nvmrc`.
- שלמות התקנת `package-lock.json`.
- קיום `.venv` וגרסאות חבילות Python הנעולות.
- TypeScript 7 מארכיון האופליין הנעול.
- esbuild אופליין.
- Chromium של Playwright.
- Tesseract ושפת OCR עברית.

בדיקות חובה מסומנות `FAIL` ומחזירות exit code 1; יכולות אופציונליות כגון Chromium/OCR מסומנות `WARN`. ניתן לקבל JSON למכונות:

```bash
npm run doctor
python tools/project_doctor.py --json
```

## 4. בדיקות property/invariant

נוספו בדיקות generated דטרמיניסטיות עם seeds קבועים, כך שכשל תמיד ניתן לשחזור ואינו תלוי בספרייה חיצונית או ברשת.

### מספור עמודי קטלוג

`tests/test_catalog_page_numbering_properties.py` בודק מאות קטלוגים ואלפי ערכים:

- `display_to_asset_page` ו-`asset_to_display_page` הפוכות בכל עמוד חוקי.
- clamp חסום, idempotent ומונוטוני.
- קלטים לא חוקיים אינם בורחים מתחום הקטלוג.

### טקסונומיה

`tests/test_taxonomy_editor_properties.py` בודק עשרות datasets generated:

- reconciliation הוא idempotent.
- סדר first-seen נשמר.
- אין זוגות קטגוריה/תת-קטגוריה כפולים.
- serialization קנוני ודטרמיניסטי ואינו משנה state.
- rename projection טהור ויציב.

### Viewer

`tests/viewer_state_transitions_properties.test.js` מפעיל את production test API על כל 11 מקורות הניווט, כיוונים ועומקי zoom, וכן מאות tokens של image swap ורזולוציה:

- כל transition מתחייב בדיוק למצב viewport ממתין אחד.
- מדיניות reset/preserve נשארת עקבית עם מקור הניווט.
- tokens ישנים לעולם אינם מבצעים commit לאחר token חדש.
- invariants נבדקים לאחר המעברים.

## 5. גבולות מכוונים

- Regex לא נאסר באופן גורף. הוא נשאר מתאים לחוזי HTML, CSS, תוכן generated ודפוסי טקסט שבהם הטקסט הוא המוצר.
- אין יעד coverage שרירותי. כל בדיקה חדשה נועלת invariant או גבול בעלות ידוע.
- Ruff אינו מבצע כרגע reformat אוטומטי.
- mypy אינו מופעל על כל `tools/` עם suppressions גורפים; הכיסוי מתרחב רק לאחר owner migration אמיתי.
- ה-doctor מאבחן בלבד ואינו מתקין, מוחק או משנה סביבת עבודה.

## 6. גבול כלי האיכות מול runtime

שינויים בשומרי חוזים, Ruff/mypy, doctor ובדיקות property אינם מחייבים שינוי בתוצרי האתר. שער `check:frontend` נשאר ההוכחה הקנונית לכך שכל generated runtime asset תואם למקורותיו; שינוי בתוצר מתבצע רק דרך ה-builder המתאים ולא כחלק מתיקון בדיקה.

## 7. Telemetry ingestion contract hardening

The telemetry endpoint now treats the browser/server boundary as a versioned data contract rather
than a permissive sanitizer. Active ingestion accepts schema v4 only and derives its accepted event
set from one `EVENT_FIELDS` owner. Each event is projected onto its own field set before storage, so
a globally known field cannot leak into an unrelated event merely because the storage layout has a
column for it. Retired `image_error` data remains readable in historical reports but is no longer an
ingestion event.

Additional invariants are enforced at the boundary:

- batches larger than the browser's 20-event contract are rejected atomically instead of truncated;
- the JSON media type is parsed exactly instead of accepting arbitrary `application/json...` prefixes;
- path values lose query strings and fragments before storage;
- low-cardinality action/rating/navigation values are allowlisted;
- error identifiers must be first-party short fingerprints;
- non-applicable image lifecycle fields are stored as empty values rather than synthetic `unknown`
  values on every unrelated event;
- JSON responses opt into `Cross-Origin-Resource-Policy: same-origin` and `Referrer-Policy: no-referrer`.

The browser's retired `durationMs` field was removed from the active client payload contract. The
Analytics Engine numeric slot remains stable as zero so historical column positions and report
compatibility are not rewritten. Contract tests compare the active ingestion event owner against the
browser event inventory and exercise malformed content types, legacy versions, retired events, field
projection, path minimization and oversized batches through real `Request`/`Response` objects.

No process-local pseudo-rate-limiter or visitor identifier was introduced. Pages Functions are
distributed and such a limiter would not provide a trustworthy global abuse boundary; collecting IP
or User-Agent solely for throttling would also violate the existing privacy model. Volumetric abuse
control remains an infrastructure concern, while the application contract minimizes and constrains
what any accepted request can place in Analytics Engine.

