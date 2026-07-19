# תשתית SEO ושיתוף — מצב פרטי וציבורי

## עקרון בטיחות

ברירת המחדל של הפרויקט היא `private`. במצב זה כל מסמך HTML מקבל `noindex`,
קובץ `_headers` מוסיף `X-Robots-Tag` חוסם, ולא נוצר `sitemap.xml`.

מעבר ל־`public` דורש שני צעדים מפורשים באותה פקודה:

```bat
--seo-mode public --confirm-public-indexing
```

שינוי `defaultMode` בקובץ ההגדרות לבדו אינו מספיק לפתיחת האתר. זהו שער מכוון
שמונע העלאה ציבורית בטעות.

## מקורות האמת

- `seo.config.json` — דומיין, CDN, שם האתר, תמונת שיתוף ופרטי העסק.
- `catalog-taxonomy.config.json` — שמות הקטגוריות, כתובות ותיאורי עמודי הקטגוריה.
- `catalogs.generated.json` — הקטלוגים, התיאורים, מספרי העמודים ומידות התמונות.
- `catalog-taxonomy.generated.js` — תוצר לדפדפן; אין לערוך אותו ידנית.

## כתובות שנוצרות

```text
/category/opening-wardrobes/
/category/kids/kids-rooms/
/catalog/opening-fredi-2026/
/catalog/opening-fredi-2026/page/43/
```

עמודי קטגוריה וקטלוג הם עמודי נחיתה יציבים המיועדים לאינדוקס רק במצב ציבורי.
עמודי עמוד מדויק מיועדים לשיתוף וממשיכים להיות `noindex` גם במצב ציבורי, כדי
לא לייצר מאות תוצאות דלות או כפולות.

## Metadata

כל עמוד נוצר מראש עם:

- title ותיאור ייחודיים;
- canonical מוחלט;
- Open Graph ו־Twitter Card;
- תמונת שיתוף של המותג, כריכת הקטלוג או העמוד המדויק;
- JSON-LD מתאים לעמוד, פירורי לחם ופרטי העסק;
- קישורים אמיתיים בתוך ה־HTML הראשוני, בלי תלות ב־JavaScript לצורך גילוי המבנה.

## פקודות שימוש

תצוגת הכנה פרטית מלאה:

```bat
npm run build:seo:private
```

באנדל העלאה רגיל, שנשאר פרטי:

```bat
npm run build:deploy
```

בדיקת בנייה ציבורית לתיקייה מקומית בלבד:

```bat
npm run build:seo:public
```

באנדל ציבורי עתידי — להשתמש רק ביום ההשקה ולאחר בדיקת production:

```bat
npm run build:deploy:public
```

## מה נכלל ב־sitemap הציבורי

- דף הבית;
- עמודי מידע ציבוריים שנבחרו;
- עמודי קטגוריה ותתי־קטגוריה;
- עמוד נחיתה אחד לכל קטלוג.

לא נכללים:

- עמודי שיתוף מדויקים;
- מועדפים;
- viewer ו־shells ישנים;
- מסכי ניהול וכלי פיתוח.

## לפני פתיחה עתידית

1. לבדוק את הבאנדל על דומיין production.
2. לוודא שכל כתובות ה־canonical וה־OG משתמשות בדומיין הנכון.
3. לבדוק שתמונות ה־CDN פתוחות לבוטי שיתוף ולסורקים.
4. להריץ את כל הבדיקות.
5. לבדוק JSON-LD בכלי הבדיקה של Google.
6. לפתוח Search Console ולשלוח את `sitemap.xml` רק לאחר ההעלאה הציבורית.

## Local source pages versus generated clean routes

The checked-in root pages intentionally use the legacy static URLs
`catalog.html?catalog=...` and `viewer.html?catalog=...&page=...`. This keeps the
normal local server compatible with plain static servers such as
`python -m http.server`, where nested clean-route files are not present.

A deploy/SEO bundle generated with `--include-seo-routes` contains the matching
`catalog/<id>/index.html` and `catalog/<id>/page/<n>/index.html` files. Those
pages declare `data-clean-routes="true"`, so browser navigation and sharing use
the clean public URLs. The source-root pages declare `data-clean-routes="false"`
and never navigate to a route that does not exist beside them.
