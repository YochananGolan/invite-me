# Apple Pay – קובץ אימות דומיין

כדי להפעיל Apple Pay באינטגרציית Iframe של טרנזילה, יש להציב כאן את קובץ האימות.

## הוראות

1. **צור קשר עם טרנזילה** – בקש את קובץ האימות ל-Apple Pay (Domain Verification File)
2. **הורד את הקובץ** – טרנזילה תספק קובץ (לעיתים בתוך ארכיון) – חלץ את קובץ ה-.dat
3. **שנה שם** – שנה את שם הקובץ ל-`apple-developer-merchantid-domain-association` (ללא סיומת)
4. **הצב כאן** – העתק את הקובץ לתיקייה זו (public/.well-known/)
5. **עדכן את טרנזילה** – הודע לטרנזילה שהקובץ הותקן כדי שיפעילו את Apple Pay למסוף שלך

## נתיב סופי

הקובץ חייב להיות נגיש בכתובת:
```
https://your-domain.com/.well-known/apple-developer-merchantid-domain-association
```

לדוגמה: https://meet-m.co.il/.well-known/apple-developer-merchantid-domain-association

## דרישות טרנזילה

- מסוף אשראי פעיל עם מספר סוחר אינטרנט
- העברת רשימת הדומיינים לטרנזילה
- התקנת הקובץ בדיוק כפי שסופק
