# Google Pay – למה התשלום נתקע באמצע

## סיבות אפשריות

### 1. הודעות ביניים מ-Tranzila
Tranzila שולחת הודעות `postMessage` במהלך תהליך Google Pay (למשל כשהמשתמש לוחץ "המשך"). חלק מההודעות מכילות קוד `Response` שאינו `000`, והמערכת פירשה אותן בטעות ככישלון והציגה "התשלום נכשל" לפני שהתהליך הסתיים.

**תיקון:** התעלמות מהודעות מ-Tranzila, עיבוד הצלחה/כישלון רק מדפי ה-callback שלנו, והשהיה של 5 שניות לפני הצגת כישלון.

### 2. ווידג'ט UserWay
ווידג'ט הנגישות של UserWay עלול לחסום שדות בטופס (למשל שדה השם) ולמנוע השלמת התשלום.

**תיקון:** הסתרת UserWay בזמן פתיחת מודל התשלום.

### 3. הרשאות iframe
Google Pay משתמש ב-Payment Request API. ה-iframe חייב הרשאות `allow="payment"` ו-`allowpaymentrequest` כדי לאפשר גישה ל-API.

**תיקון:** `allow="payment *"` ו-`allowPaymentRequest` על ה-iframe.

### 4. הגדרות Tranzila
- Google Pay חייב להיות מופעל ב-MY TRANZILA: Settings > Terminal > IFRAME Settings
- יש להשתמש ב-iframenew.php (לא הדף הישן)
- המסוף חייב להיות מסוג Standard או Regular (לא Express)

### 5. HTTPS
Google Pay לא עובד ב-HTTP. האתר חייב להיות ב-HTTPS.

### 6. מגבלות דפדפן/מכשיר
בחלק מדפדפנים או WebView (למשל באפליקציות) יש מגבלות על Payment Request API בתוך iframe.

## קונפליקט עם תשלום כרטיס אשראי רגיל
כש-Google Pay מופעל, לעיתים נוצר קונפליקט עם טופס כרטיס האשראי הרגיל (אירועים, JavaScript, או Payment Request API). כדי להשבית את Google Pay ולהשאיר רק כרטיס אשראי + Bit:

הוסף ל-`.env.local` או להגדרות Vercel:
```
NEXT_PUBLIC_DISABLE_GOOGLE_PAY=1
```

כדי להשבית גם Apple Pay:
```
NEXT_PUBLIC_DISABLE_APPLE_PAY=1
```

לאחר הוספת המשתנה יש לבנות מחדש (build) את האפליקציה.

## שגיאה 004 – סכום לא תקין
קוד 004 משמעותו "סכום לא תקין". ב-Google Pay זה יכול להיגרם מ:
- אי-התאמה בין הסכום ב-handshake לסכום בטופס (Tranzila משווה ביניהם)
- פורמט סכום לא תקין (נדרש עד 2 ספרות אחרי הנקודה)

הקוד מנרמל את הסכום לפני שליחה. אם השגיאה נמשכת – ייתכן שמדובר בהגדרה בצד Tranzila (למשל מגבלת סכום מינימלי ל-Google Pay). פנה לתמיכת Tranzila.

## אם הבעיה נמשכת
מומלץ לפנות לתמיכת Tranzila עם פרטי המסוף והדומיין, ולבדוק איתם את הגדרות Google Pay.
