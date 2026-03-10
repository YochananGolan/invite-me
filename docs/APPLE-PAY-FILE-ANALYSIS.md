# ניתוח: קובץ Apple Pay נפתח כהורדה במקום הצגה

## הבעיה
כשנכנסים ל-`/.well-known/apple-developer-merchantid-domain-association` הדפדפן מוריד קובץ ללא סיומת במקום להציג את ה-hex כטקסט.

## סיבת השורש

### 1. קבצים ללא סיומת → `application/octet-stream`
Next.js (והחבילה `mime`) משתמשים בסיומת הקובץ כדי לקבוע `Content-Type`. קובץ ללא סיומת מקבל `application/octet-stream`, וזה גורם לדפדפן להוריד במקום להציג.

מקור: [Next.js Discussion #10648](https://github.com/vercel/next.js/discussions/10648)

### 2. סדר הרצה של Rewrites
**הבעיה המרכזית:** כשמחזירים מערך פשוט מ-`rewrites()`, Next.js מתייחס אליו כ-**afterFiles** – כלומר הרארייט רץ **אחרי** בדיקת קבצים סטטיים.

סדר הבדיקה:
1. Headers, redirects
2. **beforeFiles** rewrites ← רץ לפני קבצים
3. **קבצים סטטיים** (public/, _next/static) ← הקובץ נשלח מכאן עם octet-stream
4. **afterFiles** rewrites ← הרארייט שלנו (מערך רגיל) רץ כאן – מאוחר מדי
5. דינמיים, fallback

**מסקנה:** הקובץ הסטטי נשלח קודם, והרארייט ל-API route לא מגיע לרוץ.

### 3. Production (Vercel) vs Development
משתמשים דיווחו ש-`headers()` ב-next.config.js עובדים ב-local אבל לא ב-production ב-Vercel. פתרון שעובד: `vercel.json` headers.

## הפתרון

1. **beforeFiles rewrite** – להעביר את הבקשה ל-API route **לפני** בדיקת קבצים סטטיים
2. **API route** – מחזיר את התוכן עם `Content-Type: text/plain` ו-`Content-Disposition: inline`
3. **vercel.json** (גיבוי) – headers ל-Vercel production

## איך Tranzila עושה את זה
[direct.tranzila.com](https://direct.tranzila.com/.well-known/apple-developer-merchantid-domain-association) מגיש את ה-hex כטקסט גולמי ב-`text/plain` – כנראה שרת (nginx/Apache) או CDN מוגדר במפורש ל-path הזה.
