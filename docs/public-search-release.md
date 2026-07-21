# הכנת גרסת public, שיתוף חיצוני והשקה ב־Google

מסמך זה מתאר את שערי ההשקה שכבר מובנים בפרויקט. הוא אינו פותח את האתר
לאינדוקס; ברירת המחדל נשארת `private` עד להרצה מפורשת של מצב public.

## משמעות ה־H1 בלי שינוי העיצוב

בדף הבית הטקסט הקיים בכותרת, לצד הלוגו — **„רהיטי ברגיג / גלריית קטלוגים”** —
משמש כעת כ־`h1` היחיד. אין באנר, hero או שורה חדשה לפני הקטגוריות. מבחינה
חזותית הכותרת נשארת באותו מקום ובאותו גודל.

בעמוד נחיתה של קטלוג, שם הקטלוג עצמו הוא `h1`. בעמודי קטגוריה ובמסמכי המידע
הכותרת הראשית שכבר מוצגת בעמוד נשארת `h1`.

## נעילת כתובות ציבוריות

הקובץ `seo-routes.lock.json` מקפיא את:

- מזהי הקטלוגים;
- slugs של קטגוריות;
- slugs של תתי־קטגוריות;
- הדומיין הקנוני.

בדיקה:

```bat
npm run check:seo-routes
```

לאחר הוספה או שינוי מכוון של כתובת, ורק לאחר בדיקת ההשפעה והצורך בהפניה:

```bat
npm run seo:routes:update -- --confirm-route-lock-update
```

בנייה ציבורית נכשלת אם הנעילה אינה מעודכנת. כך שינוי `id` או slug בלוח השליטה
אינו יכול לשנות כתובת שכבר פורסמה בלי פעולה מפורשת.

## בנייה וביקורת public מקומית

```bat
npm run verify:seo:public
```

הפקודה רצה דרך `tools/run_with_project_python.py`, שמוודא שסביבת `.venv` מוכנה ומפעיל את כלי הביקורת בעזרתה. כך Pillow ושאר תלויות ה־SEO זהות ב־Windows וב־CI.

הפקודה:

1. בודקת את נעילת הכתובות;
2. בונה או מאמתת באנדל public קבוע תחת `dist/site-public-preview`;
3. בודקת את כל הקישורים הפנימיים;
4. בודקת canonical ייחודי ותואם לדומיין;
5. בודקת title, description ו־H1 בכל עמוד indexable;
6. מפענחת כל JSON-LD ומוודאת מבנה מתאים;
7. בודקת Open Graph ו־Twitter Card, כולל סוג ומידות תמונה;
8. משווה את `sitemap.xml` בדיוק לרשימת העמודים ה־indexable;
9. מוודאת ש־robots.txt מפרסם את ה־sitemap ושאין noindex גלובלי ב־headers;
10. שומרת מחוץ לבאנדל חתימת ביקורת הקשורה למלאי ול־hash של כל קובץ ולקוד
    הביקורת עצמו.

הפקודה כלולה ב־`npm test` וב־`npm run verify`. כאשר החתימות עדכניות היא אינה
יוצרת או סורקת מחדש מאות קובצי HTML; שינוי בתוכן, באפשרויות הבנייה, במלאי
הקבצים, בתלויות הביקורת או בקוד הביקורת פוסל את התוצאה ומפעיל בנייה או ביקורת
מלאה לפי הצורך. ה־CI מעלה את `dist/site-public-preview` כ־artifact לבדיקה, אך
אינו מפרסם אותו.

לסריקה מלאה יזומה משתמשים ב־`npm run verify:seo:public:full`. כדי לכפות גם
בנייה מחדש משתמשים ב־`npm run verify:seo:public:rebuild`.

## בדיקה חיצונית לאחר פריסה

כלי הבדיקה החיצוני טוען את הדף ואת תמונת ה־Open Graph דרך HTTP אמיתי, מבחוץ:

```bat
npm run verify:seo:live -- --expected-mode private
```

ביום ההשקה, לאחר העלאת public:

```bat
npm run verify:seo:live -- --expected-mode public
```

הבדיקה דוגמת את דף הבית, קטגוריה וקטלוג מתוך נעילת הכתובות. היא מאמתת:

- תגובת HTTP תקינה;
- מצב index/noindex הצפוי גם ב־HTML וגם בכותרת השרת;
- כל שדות Open Graph;
- נגישות חיצונית של `og:image` עם Content-Type של תמונה.

בנוסף מומלץ לבדוק ידנית קישור אחד לפחות ביישומי השיתוף החשובים בפועל, מפני
שכל פלטפורמה שומרת cache משלה לתצוגה המקדימה.

## Search Console

מומלץ ליצור **Domain property** עבור `bargig-furniture.com`; אימות כזה נעשה
באמצעות רשומת DNS ומכסה גם תתי־דומיינים ופרוטוקולים. יצירת property אינה פותחת
את האתר לאינדוקס ואפשר לבצע אותה גם בזמן שהאתר private.

לאחר העלאת public:

1. לפתוח URL Inspection לדף הבית, לקטגוריה ולקטלוג אחד;
2. לבדוק שאין `noindex` וש־Google רואה את canonical והנתונים המובנים;
3. לשלוח `https://bargig-furniture.com/sitemap.xml` במסך Sitemaps;
4. לעקוב בשבועות הראשונים אחר Pages, Enhancements ו־Core Web Vitals;
5. לא לבקש אינדוקס ידני של מאות כתובות עמוד — ה־sitemap מיועד לעמודי הנחיתה בלבד.

מקורות רשמיים:

- https://support.google.com/webmasters/answer/34592
- https://support.google.com/webmasters/answer/7451001
- https://developers.google.com/search/docs/appearance/structured-data/local-business
- https://developers.google.com/search/docs/appearance/structured-data/sd-policies

## סדר השקה מומלץ

1. `npm test`
2. `npm run verify`
3. סקירת `dist/site-public-preview` או ה־artifact הציבורי של ה־CI
4. בדיקה שכל תמונות הקטלוג הדרושות קיימות ב־R2
5. בניית `npm run build:deploy:public` — מעתיקה את התוצר המבוקר בלי רינדור נוסף
6. העלאה באמצעות Wrangler
7. `npm run verify:seo:live -- --expected-mode public`
8. Rich Results Test עבור הבית וקטלוג לדוגמה
9. שליחת sitemap ב־Search Console

אין לשנות את `seo.config.json` ל־public כדרך קיצור. האישור הכפול נשאר בכוונה.
