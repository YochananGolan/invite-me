# הגדרת Vercel – Meet-M

## משתני סביבה (Environment Variables)

הגדר את כל המשתנים הבאים ב-Vercel: **Project Settings → Environment Variables**

### חובה – בסיס

| משתנה | תיאור | דוגמה |
|-------|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | כתובת Supabase | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | מפתח Anon של Supabase | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | מפתח Service Role – **חובה לקישור אישור הגעה** | `eyJhbGci...` |

### חובה – קישורי הזמנה

| משתנה | תיאור | דוגמה |
|-------|--------|-------|
| `NEXT_PUBLIC_APP_URL` | כתובת האתר הציבורית (לא localhost) | `https://meet-m.co.il` או `https://invite-me.vercel.app` |

### חובה – SMS

| משתנה | תיאור |
|-------|--------|
| `ACTIVETRAIL_API_KEY` | מפתח API של ActiveTrail לשליחת SMS |

### חובה – תזכורות אוטומטיות (Cron)

| משתנה | תיאור |
|-------|--------|
| `CRON_SECRET` | סיסמה סודית – Vercel שולח אותה ב-`Authorization: Bearer <CRON_SECRET>` |

### אופציונלי – אימייל (צור קשר)

| משתנה | תיאור |
|-------|--------|
| `EMAIL_HOST` | smtp.gmail.com |
| `EMAIL_PORT` | 465 |
| `EMAIL_USER` | כתובת Gmail |
| `EMAIL_PASS` | סיסמת אפליקציה |
| `CONTACT_TO` | כתובת לקבלת פניות |

### אופציונלי – Tranzila (תשלומים)

| משתנה | תיאור |
|-------|--------|
| `NEXT_PUBLIC_TRANZILA_TERMINAL` | שם המסוף |
| `TRANZILA_TERMINAL_PASSWORD` | סיסמת המסוף |

---

## Cron – תזכורות אוטומטיות

ב-`vercel.json` מוגדר:

```json
{
  "crons": [
    {
      "path": "/api/send-reminders",
      "schedule": "0 6 * * *"
    }
  ]
}
```

- **לוח זמנים:** 06:00 UTC מדי יום (08:00 או 09:00 שעון ישראל, תלוי בקיץ/חורף)
- **פעולה:** שליחת תזכורת SMS לאורחים יומיים לפני האירוע

---

## בדיקות לאחר פריסה

1. **דף הבית** – `https://your-domain.vercel.app/`
2. **קישור אישור הגעה** – `https://your-domain.vercel.app/<eventId>/<guestId>`
3. **API guest-rsvp** – `https://your-domain.vercel.app/api/guest-rsvp?eventId=X&guestId=Y`
4. **תזכורות** – בדיקה ידנית:  
   `curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.vercel.app/api/send-reminders`

---

## דומיין מותאם (meet-m.co.il)

אם משתמשים ב-`meet-m.co.il`:

1. ב-Vercel: **Project Settings → Domains** – הוסף את הדומיין
2. הגדר `NEXT_PUBLIC_APP_URL=https://meet-m.co.il`
3. הוסף רשומות DNS לפי ההוראות ב-Vercel

---

## פתרון בעיות

| בעיה | פתרון |
|------|--------|
| קישור אישור הגעה לא עובד | ודא ש-`SUPABASE_SERVICE_ROLE_KEY` מוגדר |
| קישורים ב-SMS מובילים ל-localhost | ודא ש-`NEXT_PUBLIC_APP_URL` מוגדר לכתובת ייצור |
| תזכורות לא נשלחות | ודא ש-`CRON_SECRET` מוגדר וב-Vercel Cron מופעל |
| SMS לא נשלחים | ודא ש-`ACTIVETRAIL_API_KEY` מוגדר |
