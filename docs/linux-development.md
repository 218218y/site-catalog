# התקנה והרצה בלינוקס

הפרויקט אינו מחזיק רשימת פקודות נפרדת ללינוקס. במקום לשכפל את הלוגיקה של קובצי
ה־BAT, כל פקודות התחזוקה עוברות דרך `tools/project_tasks.js`. קובצי ה־BAT של
Windows ו־`site.sh` של Linux הם מעטפות דקות לאותו מנגנון, ולכן סדר הפעולות,
השימוש ב־`.venv` והעברת הפרמטרים זהים בשתי המערכות.

## דרישות בסיס

- Linux על `x64` או `arm64`.
- Node.js בגרסה הראשית הרשומה ב־`.nvmrc`; הגרסה המדויקת המועדפת נקראת מהקובץ.
- Python 3.10 ומעלה, כולל תמיכה ביצירת `venv`.
- חיבור אינטרנט להתקנת חבילות npm, חבילות Python, חבילות מערכת ודפדפן Chromium של Playwright.
- ב־Ubuntu/Debian נדרשים `apt-get` ו־`sudo` למשתמש שאינו root, כדי שההתקנה תוכל להשלים אוטומטית את חבילות המערכת.

אם Python עדיין אינו מוכן ליצירת סביבה וירטואלית, התקן פעם אחת:

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip
```

את Tesseract ואת נתוני השפה אין צורך להתקין ידנית: `setup-linux.sh` בודק אותם
ומתקין אוטומטית רק כאשר חסרים `tesseract-ocr`, ‏`tesseract-ocr-eng` או
`tesseract-ocr-heb`.

מומלץ להשתמש ב־nvm עבור Node. מתוך תיקיית הפרויקט, לאחר התקנת nvm:

```bash
nvm install
nvm use
node --version
```

`nvm install` ו־`nvm use` ללא מספר גרסה קוראים את `.nvmrc`, ולכן אין להעתיק את
מספר הגרסה למסמכים או לסקריפטים נוספים.

## התקנה ראשונה

מתוך שורש הפרויקט:

```bash
chmod +x setup-linux.sh site.sh
./setup-linux.sh
```

הפקודה מבצעת, לפי הסדר:

1. ב־Linux, בדיקה של Tesseract ושל השפות `eng` ו־`heb`. רק אם משהו חסר היא
   מריצה `apt-get update`, מתקינה את חבילות ה־OCR דרך `sudo` ומאמתת שוב את
   קובץ ההרצה ואת שתי השפות.
2. `npm ci` לפי `package-lock.json`.
3. ניקוי cache ו־bytecode ישן מעץ המקור.
4. יצירה או תיקון של `.venv` והתקנת גרסאות Python הנעולות בפרויקט.
5. התקנת Chromium התואם לגרסת Playwright הנעולה.

ב־Ubuntu/Debian נקי, כאשר חסרות גם ספריות המערכת של Chromium, השתמש:

```bash
./setup-linux.sh --with-browser-deps
```

אפשרות זו מפעילה את מתקין Playwright עם `--with-deps` ועלולה לבקש `sudo`.
הפרויקט נועל את Playwright לגרסה שתומכת רשמית גם ב־Ubuntu 26.04. אין לעקוף
שגיאת מערכת לא נתמכת באמצעות Chromium חיצוני או `executablePath`; יש לעדכן יחד
את `package.json`, את `package-lock.json` ואת חוזה התחזוקה לגרסת Playwright נתמכת.
בהפצות Linux שאינן נתמכות רשמית על ידי Playwright, מריצים תחילה
`./setup-linux.sh` ומתקינים ידנית את ספריות הדפדפן שהבדיקה מדווחת שחסרות.

להתקנה ללא דפדפן, למשל במחשב שמבצע רק המרות ובנייה:

```bash
./setup-linux.sh --skip-browsers
```

בהפצת Linux שאינה מבוססת Ubuntu/Debian, או כאשר חבילות ה־OCR מנוהלות ידנית,
אפשר לדלג במכוון רק על התקנת חבילות המערכת:

```bash
./setup-linux.sh --skip-ocr-system-deps
```

הדגל אינו מבטל OCR בקוד. הוא רק מונע מ־setup להשתמש ב־`apt-get`; אם Tesseract
או `eng`/`heb` חסרים, פקודות ההמרה עדיין ידווחו על כך. ב־Ubuntu מומלץ להשאיר
את ברירת המחדל ולא להשתמש בדגל.

אין צורך להריץ `source .venv/bin/activate`. מפעיל הפרויקט מאתר `python3` או
`python`, בודק שמדובר ב־Python 3.10 ומעלה, ומריץ כל כלי דרך ה־Python המדויק של
`.venv`. כך פקודה אינה מצליחה בטעות בגלל חבילה גלובלית שקיימת רק במחשב מסוים.

## עזרה ורשימת פקודות

```bash
./site.sh help
```

## התאמה בין פקודות Windows לפקודות Linux

| Windows | Linux |
|---|---|
| `.20-setup-windows.bat` | `./setup-linux.sh` |
| `sync-catalog-pdfs.bat` | `./site.sh sync-catalog-pdfs` |
| `.10-convert-catalogs.bat` | `./site.sh convert-catalogs` |
| `.011-convert-catalogs-force.bat` | `./site.sh convert-catalogs-force` |
| `.012-refresh-ocr-search.bat` | `./site.sh refresh-ocr-search` |
| `.06-sync-r2-images-preview.bat` | `./site.sh r2-preview` |
| `.07-sync-r2-images.bat` | `./site.sh r2-sync` |
| `.01-bundle-site-r2.bat` | `./site.sh bundle-site-r2` |
| `.02-bundle-site-r2-upload cloudflare.bat` | `./site.sh deploy-cloudflare` |
| `configure-r2-cors.bat` | `./site.sh configure-r2-cors` |
| `.05-start-server.bat` | `./site.sh server` |
| `.03-check-and-start-server.bat` | `./site.sh server-check` |
| `.04-catalog-control-panel.bat` | `./site.sh control-panel` |
| `.20-telemetry-report.bat` | `./site.sh telemetry-report` |
| `.020-clean-project-artifacts.bat` | `./site.sh clean` |

פרמטרים נוספים עוברים לכלי היעד בלי shell ביניים. דוגמאות:

```bash
./site.sh r2-sync --no-delete
./site.sh deploy-cloudflare --preview-branch test-name
./site.sh bundle-site-r2 --include-json
```

לבדיקת רצף פקודות בלי לבצע שינוי:

```bash
./site.sh --dry-run bundle-site-r2
./site.sh --dry-run deploy-cloudflare --preview-branch test-name
```

## פקודות npm

כל פקודות `package.json` שמפעילות Python משתמשות כעת ב־
`tools/run_project_python.js`. לכן הן עובדות ב־Linux גם כאשר הפקודה `python`
אינה קיימת ורק `python3` מותקן, והן אינן תלויות בהפעלה ידנית של `.venv`.

```bash
npm run build:frontend
npm run build:pages
npm test
npm run verify
npm run check:types
```

פקודות התחזוקה היומיומיות זמינות גם דרך npm, אך `site.sh` קצר וברור יותר:

```bash
npm run catalogs:convert
npm run r2:sync:preview
npm run site:bundle:r2
npm run site:control-panel
```

## זרימת עבודה מומלצת בלינוקס

```bash
./site.sh sync-catalog-pdfs
./site.sh convert-catalogs
./site.sh r2-preview
./site.sh r2-sync
./site.sh bundle-site-r2
./site.sh server
```

לאחר בדיקת האתר המקומי:

```bash
./site.sh deploy-cloudflare
```

לפריסת preview בלבד:

```bash
./site.sh deploy-cloudflare --preview-branch test-name
```

## Cloudflare ו־R2

- `r2.env` ו־`telemetry.env` נשארים מקומיים ואינם נכנסים ל־Git או לבאנדל.
- מומלץ להגביל הרשאות קריאה לקבצים המקומיים:

```bash
chmod 600 r2.env telemetry.env
```

- Wrangler מותקן מקומית ונעול ב־`package-lock.json`; כלי הפריסה משתמש בגרסה
  המקומית מתוך `node_modules`, לא בגרסה גלובלית ולא בהורדה אקראית דרך `npx`.
- לצורך התחברות אינטראקטיבית ל־Cloudflare לאחר ההתקנה:

```bash
./node_modules/.bin/wrangler login
```

## npm במצב אופליין לסביבת הצ׳אט

מראת האופליין מיועדת במכוון ל־Linux `x64` עם `glibc` בלבד. היא אינה כוללת
Windows, macOS, ARM64, musl או דפדפני Playwright.

אחרי `npm update`, שינוי `package.json` או שינוי `package-lock.json`, מריצים
פעם אחת עם חיבור רשת:

```bash
npm run update:offline:linux
npm run check:offline:linux
```

הפקודה קוראת את השמות והגרסאות מ־`package-lock.json`, מסננת את החבילות
לפלטפורמת הצ׳אט, ממחזרת tarballs קיימים ומורידה רק את החסר. שש חבילות Wrangler
ב־lockfile הנוכחי חסרות `resolved` ו־`integrity`; הן חבילות registry רגילות ולא
bundled. עבורן הפקודה מריצה `npm pack` בגרסה המדויקת, מאמתת שם/גרסה ושומרת
integrity נגזר. התוצאה כוללת `manifest.json` ו־`package-lock.offline.json` תחת
`vendor/npm/linux-x64-glibc`, בלי לשנות את `package-lock.json` המקורי.

במכונת Linux x64/glibc מנותקת מרשת מתקינים את כל עץ npm כך:

```bash
npm run setup:npm:offline:linux
```

המתקין משתמש זמנית ב־`npm-shrinkwrap.json` הנגזר, שבו כל `resolved` הוא
`file:` מקומי, ומריץ `npm ci --offline` עם cache זמני שנמחק בסיום. הוא מגדיר
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, ולכן חבילות `@playwright/test`,
`playwright` ו־`playwright-core` זמינות לקוד ולבדיקות שאינן פותחות דפדפן, בלי
לצרף Chromium. בדיקות E2E דורשות התקנת דפדפן נפרדת ורשת:

```bash
npm run setup:browsers
```


לאחר עדכון מוצלח נמחקים אוטומטית הכפילויות הישנות:

```text
vendor/npm/esbuild/
vendor/npm/typescript/
.cache/npm-offline-linux/
```

אין למחוק אותן לפני שהעדכון הצליח, משום שהפקודה יכולה למחזר מהן את ה־tarballs
הקיימים. לאחר ההצלחה כל bootstrap ממוקד קורא מן המראה הקנונית החדשה בלבד.

לפעולות ממוקדות שלא צריכות את Wrangler, sharp או Playwright נשארו bootstraps
קטנים יותר:

```bash
npm run setup:esbuild:offline
npm run check:esbuild:offline
npm run setup:typescript:offline
npm run check:typescript:offline
```

גם הם קוראים כעת את הגרסה והחתימה מה־lockfile ואינם דורשים עדכון ידני של
מספרי גרסאות בתוך קוד Python. ב־Windows ממשיכים להשתמש ב־`npm ci` הרגיל.

## תקלות נפוצות

### `Permission denied` בעת הרצת הסקריפט

```bash
chmod +x setup-linux.sh site.sh
```

### נמצאה גרסת Node ראשית שגויה

```bash
nvm install
nvm use
```

לעקיפה מכוונת בלבד, למשל לבדיקת תאימות זמנית:

```bash
./setup-linux.sh --allow-node-version-mismatch
```

### Python נמצא אך `venv` אינו נוצר

ב־Ubuntu/Debian התקן:

```bash
sudo apt install -y python3-venv
```

### Playwright מדווח ש־Ubuntu 26.04 אינו נתמך

בדוק שהתקנת את התלויות מחדש לפי קובץ הנעילה המעודכן:

```bash
rm -rf node_modules
npm ci
./setup-linux.sh --with-browser-deps
```

הודעה שמזכירה Playwright `1.55.1` או `1.61.1` פירושה שעדיין מותקנת
גרסת פרויקט ישנה; הגרסה הנעולה בפרויקט היא `1.62.0`.

### Playwright מותקן אך Chromium אינו עולה

```bash
./setup-linux.sh --with-browser-deps
```

### OCR נכשל עם הודעה ש־Tesseract או שפה חסרים

הרץ שוב את ההתקנה בלי להוריד מחדש את הדפדפן:

```bash
./setup-linux.sh --skip-browsers
```

לאימות ידני:

```bash
tesseract --version
tesseract --list-langs
```

ברשימת השפות צריכים להופיע `eng` ו־`heb`. רק אם נדרש תיקון ידני:

```bash
sudo apt update
sudo apt install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng tesseract-ocr-heb
```

### אין צורך ב־activate

אל תפתור תקלה על ידי התקנת Pillow, PyMuPDF או pytest גלובלית. הרץ שוב:

```bash
./setup-linux.sh
```

המנגנון יתקן את `.venv` לפי גרסאות הדרישות הנעולות.
