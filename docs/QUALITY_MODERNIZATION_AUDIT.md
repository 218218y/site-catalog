# ביקורת מודרניזציית בדיקות וכלי איכות — שלב 4

## מטרת השלב

השלב מחזק את מעטפת האיכות בלי לשנות קוד runtime, DOM, CSS או תוצרי האתר. העיקרון המנחה הוא להחליף חוזים שמזהים טקסט מקרי בחוזים שמבינים מבנה קוד, ולהוסיף בדיקות מבוססות invariants במקומות שבהם מספר שילובי הקלט גדול מדי לבדיקות דוגמה ידניות.

## 1. חוזים מבניים מבוססי AST

נוספה שכבת AST משותפת המבוססת על TypeScript 5.8 הנעול בפרויקט:

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

בבסיס שלפני השינוי היו 1,444 assertions מסוג match/doesNotMatch ב-54 קובצי JavaScript. לאחר השלב יש 1,358 assertions ב-50 קבצים: 86 assertions מבניים הוסרו מהמוקדים הקריטיים, בלי לבצע המרה עיוורת של חוזי HTML/CSS לגישה מורכבת יותר.

## 2. Ruff ו-mypy כשערים מדורגים

נוסף `pyproject.toml` מרכזי.

Ruff מתחיל ב-ratchet של שגיאות correctness בלבד (`E9`, `F63`, `F7`, `F82`) על `tools` ו-`tests`. הבחירה מכוונת: השלב אינו מערבב רפורמט רחב עם שינויי בדיקות, אך מעכשיו שגיאות תחביר, bindings בלתי חוקיים ושמות בלתי מוגדרים חוסמים verification. כללי style/import-order יתווספו בגלים נפרדים לאחר תיקון מדוד.

mypy מופעל עם `disallow_untyped_defs`, `check_untyped_defs`, `no_implicit_optional` ואזהרות על unreachable/ignores מיותרים. השער מתחיל במודולי תשתית וחוזה בעלי annotations מלאים:

- `tools/catalog_page_numbering.py`
- `tools/taxonomy_editor.py`
- `tools/check_frontend_contracts.py`
- `tools/project_doctor.py`
- `tools/setup_python_env.py`
- `tools/verify_project.py`

זהו ratchet אמיתי ולא `ignore_errors`: מודול שנכנס לרשימה חייב לעמוד בחוזה המלא. הרחבת הרשימה צריכה להתבצע owner אחר owner, בלי להכניס מאות suppressions.

הגרסאות נעולות ב-`tools/requirements-dev.txt`, נבדקות ב-bootstrap של `.venv`, ונוספו כשלבים חובה לפני pytest ב-`tools/verify_project.py`.

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
- TypeScript 5.8 ו-TypeScript 7 מארכיוני האופליין.
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

## 6. הוכחת גבול runtime

השינוי נוגע רק בכלי פיתוח, בדיקות, תצורה ותיעוד. כל 13 נכסי ה-frontend שנבדקו — ארבעת באנדלי JavaScript, ארבעת קובצי CSS, ארבעת מודולי runtime החיצוניים ו-Search Worker — נשארו זהים byte-for-byte לבסיס שלפני שלב 4.
