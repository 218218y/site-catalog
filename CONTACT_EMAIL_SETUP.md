# הפעלת טופס יצירת קשר עם Resend + Netlify

## מה כבר מוכן בקבצים

- `index.html` — טופס יצירת קשר בסוף העמוד.
- `app.js` — שליחה ל־`/api/contact`, בדיקות שדות, הודעת הצלחה/שגיאה.
- `netlify/functions/contact.js` — פונקציית שרת ששולחת מייל דרך Resend בלי לחשוף API key בדפדפן.
- `netlify.toml` — מפנה את `/api/contact` אל הפונקציה.
- `.env.example` — דוגמה לשמות משתני הסביבה שצריך להגדיר.

## מה חסר כדי שיעבוד באתר

1. לפתוח חשבון ב־Resend.
2. ליצור API key.
3. להוסיף ולאמת דומיין ב־Resend.
4. ב־Netlify להגדיר Environment Variables:

```text
RESEND_API_KEY=המפתח_שלך_מ־Resend
CONTACT_FROM_EMAIL=contact@your-domain.co.il
CONTACT_FROM_NAME=רהיטי ברגיג
CONTACT_TO_EMAIL=bargig218@gmail.com
CONTACT_SITE_NAME=רהיטי ברגיג
```

`CONTACT_FROM_EMAIL` חייב להיות תחת דומיין שאומת ב־Resend.

## פריסה נכונה

צריך לפרוס גם את:

```text
netlify.toml
netlify/functions/contact.js
```

לא להעלות רק HTML/CSS/JS, כי השליחה נעשית דרך Function.

מומלץ לפרוס דרך Git שמחובר ל־Netlify או דרך Netlify CLI.
