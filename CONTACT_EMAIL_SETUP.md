# הפעלת טופס יצירת קשר פשוט עם Netlify Forms

זה הפתרון הפשוט לאתר שנמצא על Netlify, גם בלי דומיין פרטי.

## מה לא צריך

- לא צריך Resend.
- לא צריך API key.
- לא צריך דומיין פרטי.
- לא צריך Netlify Function.
- לא צריך להגדיר Environment Variables.

## הקבצים הרלוונטיים

- `index.html` — כולל טופס יצירת קשר עם `data-netlify="true"`.
- `app.js` — שולח את הטופס ל־Netlify Forms ומציג הודעת הצלחה/שגיאה.
- `styles.css` — עיצוב הטופס.
- `netlify.toml` — נשאר רק כקובץ תיעוד קצר; אין בו Function או Redirect.

## מה לעשות אחרי העלאה ל־Netlify

1. להעלות את האתר ל־Netlify.
2. להיכנס לפרויקט ב־Netlify.
3. לוודא ש־Form detection פעיל תחת `Project configuration → Forms`.
4. לשלוח הודעת ניסיון מהטופס באתר.
5. לבדוק תחת `Forms` שנוצר טופס בשם `store-contact` ושהפנייה מופיעה שם.

## קבלת התראות למייל

Netlify שומרת את הפניות בדשבורד. כדי לקבל מייל בכל פנייה:

1. להיכנס ל־`Project configuration → Notifications`.
2. לבחור `Emails and webhooks`.
3. תחת `Form submission notifications` ללחוץ `Add notification`.
4. לבחור Email notification.
5. לבחור את הטופס `store-contact`.
6. להכניס את המייל שאליו רוצים לקבל פניות, למשל `bargig218@gmail.com`.
7. לשמור.

## קבצים שאפשר למחוק מהפתרון הקודם

```text
.env
.env.example
netlify/functions/contact.js
```

אם התיקייה `netlify/functions` נשארת ריקה — אפשר למחוק גם אותה.
