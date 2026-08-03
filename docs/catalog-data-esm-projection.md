# נתוני הקטלוג והטקסונומיה כ־ESM חיצוני

## המצב הפעיל

נתוני הדפדפן נוצרים כשני מודולי ESM immutable:

```text
catalogs.generated.module.js
catalog-taxonomy.generated.module.js
```

הם מיוצרים יחד עם `catalogs.generated.json` מאותו model קנוני, נטענים ב־static imports ואינם מפרסמים globals. קובצי ה־classic הקודמים הוסרו; אין fallback, bridge או dual source.

החוזה הציבורי המצומצם הוא:

```js
export const catalogs = Object.freeze(/* generated catalog records */);
export const catalogTaxonomy = Object.freeze(/* generated taxonomy */);
```

`catalog-assets.config.js` נשאר classic bootstrap קטן ונפרד, מפני שהוא מכיל מדיניות delivery ו־CDN שנקבעת בזמן הפריסה ולא נתוני קטלוג.

## גרף בנייה ו־cache

1. `tools/catalog_compiler.py` מפיק את מודול הקטלוג ואת ה־JSON מאותו payload דטרמיניסטי.
2. `tools/seo_site.py` מפיק את מודול הטקסונומיה מאותו payload שמשמש ליצירת עמודי האתר.
3. `tools/build_frontend_assets.py` משאיר את שני המודולים external, ולכן ה־Route bundles אינם משכפלים את הנתונים.
4. `tools/build_deploy_bundle.py` מקצה fingerprint לנתונים תחילה, משכתב את imports של ה־runtime וה־routes לדור היחיד הזה, ורק אז מקצה להם fingerprint.
5. שינוי בקוד route שאינו משנה נתונים אינו משנה את hash של מודולי הנתונים.
6. `catalogs.search-index.json` נשאר artifact נפרד של ה־Worker ואינו נכנס לגרף הדפדפן.

## מקור אמת וערבויות

- מקור האמת: `catalogs.config.json`, `catalog-taxonomy.config.json` ו־`catalogs.build-state.json`.
- `catalogs.generated.json` הוא projection מכונה לכלי build, SEO, R2, telemetry ותחזוקה.
- מודולי ה־ESM הם projections לדפדפן בלבד ואינם מכילים behavior, DOM access או side effects.
- חוזי parity מאמתים שנתוני ה־JSON וה־ESM זהים סמנטית ובאותו סדר.
- חוזי build מאמתים שכל consumer מצביע לדור fingerprinted יחיד ושאין generation ישן או לא־מקושר.
- `Window` אינו מכריז ואינו מקבל `BARGIG_CATALOGS` או `BARGIG_CATALOG_TAXONOMY` ביישום האתר.

ה־viewer האבחוני העצמאי תחת `catalog-big-pages-viewer-netfree/` הוא snapshot בלתי תלוי שנבנה אוטומטית מה־JSON. ה־global הפנימי שלו אינו חלק מיישום האתר, אינו נפרס כ־route dependency ואינו נתיב תאימות.

## שמירת החוזה

- אין להחזיר `<script>` קלאסי עבור catalog data או taxonomy.
- אין להוסיף fallback מ־ESM ל־`window`.
- אין לייבא את `catalogs.generated.json` ישירות בקוד דפדפן.
- אין לאגד עותק של הנתונים בתוך כל Route bundle.
- שינוי shape מתחיל בסכמות וב־compiler, ומחייב parity, typecheck ובדיקת deploy graph.
