import Head from 'next/head';
import Link from 'next/link';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';

const pClass = 'text-base leading-relaxed text-slate-300 mb-4';
const h2Class = 'text-2xl font-bold mb-4 text-white';

export default function Terms() {
  return (
    <>
      <Head>
        <title>תנאי שימוש ומדיניות פרטיות | Meet-M</title>
        <meta name="description" content="תנאי השימוש ומדיניות הפרטיות של Meet-M, גולן אפליקציות - מייטאם" />
      </Head>

      <div className="min-h-screen flex flex-col bg-[linear-gradient(160deg,#0d0f2b_0%,#130f35_52%,#1a0f40_100%)] text-slate-100">
        <NavBar />

        <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
          <Link
            href="/"
            className="inline-flex items-center text-indigo-300 hover:text-white mb-6 font-medium transition-colors"
          >
            ← חזרה לדף הבית
          </Link>

          <article className="rounded-2xl border border-white/15 bg-white/[0.055] backdrop-blur-xl shadow-[0_4px_32px_rgba(0,0,0,0.3)] p-6 sm:p-8 max-w-none" dir="rtl">
            <h1 className="text-3xl sm:text-4xl font-bold text-center mb-6 text-white">תנאי שימוש ומדיניות פרטיות</h1>

            <ul className="list-none space-y-1 text-base leading-relaxed text-slate-300 mb-4">
              <li>מפעיל: גולן אפליקציות - מייטאם</li>
              <li>מספר עוסק: 065567158</li>
              <li>כתובת למשלוח דואר: ת״ד 6043, קדימה צורן</li>
              <li>טלפון: <a href="tel:0505304642" className="text-indigo-300 hover:text-indigo-200 whitespace-nowrap">050-5304642</a></li>
              <li>דוא״ל: <a href="mailto:gyapps1@gmail.com" className="text-indigo-300 hover:text-indigo-200 whitespace-nowrap">gyapps1@gmail.com</a></li>
            </ul>
            <p className={pClass}>תאריך נוסח: 28 בספטמבר 2026. הדין החל: דין מדינת ישראל.</p>

            <section className="mb-8">
              <h2 className={h2Class}>1. זהות, השירות וההגדרות</h2>
              <p className={pClass}>
                האתר והשירות Meet-M מופעלים על ידי גולן אפליקציות - מייטאם, עוסק מספר 065567158, שכתובתו למשלוח דואר היא ת״ד 6043, קדימה צורן, וטלפונו{' '}
                <a href="tel:0505304642" className="text-indigo-300 hover:text-indigo-200 whitespace-nowrap">050-5304642</a>.
              </p>
              <p className={pClass}>
                Meet-M הוא אתר ושירות ליצירת הזמנה דיגיטלית, ניהול רשימת אורחים, שליחת הזמנה ב־SMS או ב־WhatsApp, קבלת אישור הגעה והצגת דוחות.
              </p>
              <p className={pClass}>
                „משתמש” הוא מי שפתח חשבון, והוא בגיר מעל גיל 18. „אורח” הוא אדם שהמשתמש הזין את פרטיו. המשתמש מחליט את מי לזמן ומה נשלח אליו. המפעיל מעבד את פרטי האורח לפי הוראת המשתמש.
              </p>
              <p className={pClass}>
                „מידע אישי” הוא מידע שמזהה אדם, ובכלל זה שם, דוא״ל, טלפון, כתובת IP ומזהה חשבון. „מידע על אורח” כולל שם, טלפון, מספר שולחן, מספר מבוגרים וילדים, סטטוס הגעה, העדפות אוכל ואלרגיה. העדפות אוכל ואלרגיה נשמרות לצורך האירוע בלבד, ואינן משמשות לשיווק.
              </p>
              <p className={pClass}>„עיבוד” הוא כל פעולה במידע, ובכלל זה איסוף, שמירה, שימוש, העברה ומחיקה.</p>
            </section>

            <section className="mb-8">
              <h2 className={h2Class}>2. גבולות השירות</h2>
              <p className={pClass}>
                השירות הוא כלי תפעולי. אין בו התחייבות שכל הודעה תגיע, שכל אורח יאשר הגעה, או שסידור ההושבה וההזנה באירוע יהיו נכונים. המסירה בפועל תלויה גם בגורמים שבסעיף 7.7. נתונים בכרטיסי ההדגמה בעמוד הבית הם המחשה, לא תוצאה של לקוח.
              </p>
              <p className={pClass}>
                המשתמש ישתמש באתר למטרות חוקיות בלבד. המפעיל רשאי לשנות את האתר או להסיר תוכן שמפר את התנאים או את הדין, ובמקרה של שינוי מהותי בשירות יינתן עדכון באתר.
              </p>
            </section>

            <section className="mb-8">
              <h2 className={h2Class}>3. חשבון והסכמה</h2>
              <p className={pClass}>פתיחת חשבון ושימוש באתר מהווים הסכמה למסמך זה. תיבת אישור בעת ההרשמה, „קראתי את תנאי השימוש ואת מדיניות הפרטיות”, תתווסף בגרסה מעודכנת של האתר.</p>
              <p className={pClass}>
                ההסכמה ניתנת לביטול בפנייה אל{' '}
                <a href="mailto:gyapps1@gmail.com" className="text-indigo-300 hover:text-indigo-200 whitespace-nowrap">gyapps1@gmail.com</a>
                {' '}או אל{' '}
                <a href="tel:0505304642" className="text-indigo-300 hover:text-indigo-200 whitespace-nowrap">050-5304642</a>.
                הביטול עוצר עיבוד שאינו חובה לפי דין, ואינו מוחק חיוב על שירות שכבר סופק.
              </p>
            </section>

            <section className="mb-8">
              <h2 className={h2Class}>4. אחריות המשתמש כלפי אורחים</h2>
              <p className={pClass}>
                לפני העלאת רשימה ולפני כל שליחה המשתמש מצהיר שיש לו בסיס חוקי לפנות לכל מספר ולכל שם שהוא מזין, ושהרשימה אינה תפוצה שנרכשה או נאספה בלי רשות.
              </p>
              <p className={pClass}>
                המשתמש מצהיר שיש לו בסיס חוקי למסור העדפות אוכל ואלרגיות, ושהמידע דרוש לאירוע בלבד. נוסח ההודעה, מועדי האירוע ופרטי האורחים הם באחריות המשתמש. המפעיל שולח את מה שהמשתמש אישר לשלוח.
              </p>
            </section>

            <section className="mb-8">
              <h2 className={h2Class}>5. תשלום</h2>
              <p className={pClass}>
                הרשמה לחשבון אינה תשלום על שליחות. שליחה מעבר למכסה הכלולה כרוכה בתשלום חד־פעמי לפי המסלול שמוצג לפני האישור, באמצעות טרנזילה. פרטי כרטיס האשראי מוזנים אצל טרנזילה. לפני החיוב יוצגו המחיר, מה כלול בו, וקישור לסעיף 6.
              </p>
            </section>

            <section className="mb-8">
              <h2 className={h2Class}>6. ביטול עסקה והחזרים</h2>
              <p className={pClass}>
                בעסקת מכר מרחוק המשתמש רשאי לבטל לפי חוק הגנת הצרכן ותקנות ביטול עסקה. הבקשה נשלחת אל{' '}
                <a href="mailto:gyapps1@gmail.com" className="text-indigo-300 hover:text-indigo-200 whitespace-nowrap">gyapps1@gmail.com</a>,
                אל <a href="tel:0505304642" className="text-indigo-300 hover:text-indigo-200 whitespace-nowrap">050-5304642</a>,
                או בדואר אל ת״ד 6043, קדימה צורן, ותיענה בכתב.
              </p>
              <p className={pClass}>
                הודעות שכבר נשלחו, ומכסה שכבר נוצלה, הן שירות שסופק. החזר, אם קם לפי דין, יחושב על החלק שלא סופק, בניכוי דמי ביטול שהדין מתיר. מסלול ללא תשלום אינו מזכה בהחזר כספי.
              </p>
            </section>

            <section className="mb-8">
              <h2 className={h2Class}>7. הגבלת אחריות ושיפוי</h2>
              <p className={pClass}>7.1. השירות ניתן כמות שהוא. אין התחייבות לזמינות רצופה, למסירה של כל הודעה, או להתאמה למטרה מסוימת מעבר לסעיף 2.</p>
              <p className={pClass}>7.2. המפעיל לא אחראי להחלטת המשתמש את מי לזמן, לנוסח שהוא מאשר, לנכונות אלרגיות והעדפות אוכל, ולא לתוצאת האירוע.</p>
              <p className={pClass}>7.3. אחריות המפעיל לנזק ממון מכישלון טכני של השירות עצמו מוגבלת לסכום ששולם למפעיל עבור אותו אירוע בשלושת החודשים שקדמו לאירוע הנזק. במסלול ללא תשלום התקרה היא אפס, למעט סעיף 7.5.</p>
              <p className={pClass}>7.4. המפעיל לא ישא בנזק תוצאתי, באובדן רווח, בפגיעה במוניטין או בעוגמת נפש, ככל שהדין מתיר הגבלה זו.</p>
              <p className={pClass}>7.5. אין בסעיף 7 כדי להגביל אחריות שאי אפשר להתנות עליה: הטעיה, זדון, נזק גוף, או חובה לפי חוק הגנת הצרכן וחוק הגנת הפרטיות.</p>
              <p className={pClass}>
                7.6. המשתמש ישפה את המפעיל, את עובדיו ואת ספקיו על תביעה, דרישה, קנס או הוצאה סבירה, לרבות שכר טרחת עורך דין, שנובעים מפנייה לאורח בלי בסיס חוקי, מתוכן שהמשתמש הזין, ממסירת אלרגיה או העדפת אוכל בלי הרשאה, מהפרת סעיף 30א לחוק התקשורת, או מהפרת זכות יוצרים בחומר שהמשתמש העלה. השיפוי חל אחרי שהמפעיל הודיע למשתמש על הדרישה בתוך זמן סביר ואפשר לו להשתתף בהגנה.
              </p>
              <p className={pClass}>
                7.7. גופים חיצוניים. השירות נשען על גופים עצמאיים שאינם בשליטת המפעיל, ובכלל זה טרנזילה לסליקה, Green API ו־Meta / Facebook ל־WhatsApp, ActiveTrail ל־SMS, Vercel לאירוח, Supabase לאחסון ולהתחברות, וכן ספק הדוא״ל, UserWay ו־Google Fonts, וכל ספק שיחליף אחד מאלה.
              </p>
              <p className={pClass}>
                למפעיל אין שליטה על זמינותם, על תקינותם, על מדיניותם, על אבטחתם או על לוחות הזמנים שלהם. תקלה, עיכוב, השעיה, שינוי מדיניות, חסימת חשבון או הפסקה אצל גוף אחד או אצל כמה גופים יחד עלולים למנוע כניסה, לשבש תשלום, לעכב או לבטל מסירת הודעה, או להשבית דיווח.
              </p>
              <p className={pClass}>
                נזק שנגרם מכך, ובכלל זה אי־הגעה של הזמנה, איחור באישור תשלום, או אי־קיום אירוע כמתוכנן, אינו הפרה של המפעיל ואינו מקים חובת פיצוי מעבר לתקרה בסעיף 7.3. אין אחריות לנזק תוצאתי, לאובדן רווח, לפגיעה במוניטין או לעוגמת נפש שנובעים מגוף חיצוני, ככל שהדין מתיר הגבלה זו.
              </p>
              <p className={pClass}>
                המפעיל יפעל בתוך זמן סביר לחידוש החיבור או למעבר לספק חלופי, כשקיימת חלופה סבירה מבחינה מסחרית. מכסה ששולמה ושלא נוצלה בגלל תקלה כזו תטופל לפי סעיף 6, ולא כתביעת נזק על תוצאת האירוע.
              </p>
              <p className={pClass}>אין בסעיף 7.7 כדי לפטור את המפעיל מאחריות שאי אפשר להתנות עליה לפי דין, ובכלל זה הטעיה או זדון של המפעיל עצמו.</p>
            </section>

            <section className="mb-8">
              <h2 className={h2Class}>8. מדיניות פרטיות</h2>
              <p className={pClass}>8.1. על המשתמש נאספים שם מלא, דוא״ל, טלפון אם נמסר, מזהה חשבון, פרטי האירוע, בחירת עיצוב, היסטוריית תשלום מול טרנזילה בלי מספר כרטיס מלא, ופניות לדוא״ל.</p>
              <p className={pClass}>8.2. על אורח נאספים הנתונים שהמשתמש הזין, לצורך ההזמנה, אישור ההגעה והדוח.</p>
              <p className={pClass}>8.3. המטרות הן פתיחת החשבון, הפעלת האירוע, שליחת ההודעה שהמשתמש אישר, גבייה, אבטחה, מענה לפנייה, וחובה לפי דין.</p>
              <p className={pClass}>8.4. אין שימוש במידע לשיווק לפני הוספת תיבת הדיוור שבסעיף 10, ורק אם סומנה.</p>
              <p className={pClass}>8.5. המעבדים בפועל הם Supabase, טרנזילה, Meta WhatsApp, Green API, ActiveTrail, ספק הדוא״ל שמוגדר בשרת והיעד שלו הוא gyapps1@gmail.com, UserWay ו־Google Fonts.</p>
              <p className={pClass}>8.6. בקוד אין Google Analytics, פיקסל פרסום או כלי מדידת קמפיינים. אם כלי כזה יתווסף, המדיניות תעודכן לפני ההפעלה, והכלי לא ייטען לפני אישור כשנדרש אישור.</p>
              <p className={pClass}>8.7. מידע על אורח נשמר כל עוד האירוע פעיל ולתקופה סבירה אחר כך לצורך הוכחת שליחה, גבייה ובירור תלונה, ואחר כך נמחק או מנוטרל.</p>
              <p className={pClass}>
                8.8. עיון, תיקון או בקשת מחיקה נעשים אל{' '}
                <a href="mailto:gyapps1@gmail.com" className="text-indigo-300 hover:text-indigo-200 whitespace-nowrap">gyapps1@gmail.com</a>,
                אל <a href="tel:0505304642" className="text-indigo-300 hover:text-indigo-200 whitespace-nowrap">050-5304642</a>,
                או בדואר אל ת״ד 6043, קדימה צורן. מחיקה לא תבוצע כשהדין מחייב שמירה, למשל רישום תשלום. המפעיל נוקט אמצעי גישה מוגבלים, גיבוי אצל ספק האחסון, והעברת תשלום ישירות לטרנזילה.
              </p>
            </section>

            <section className="mb-8">
              <h2 className={h2Class}>9. עוגיות ואחסון בדפדפן</h2>
              <p className={pClass}>
                עוגיית ההתחברות, ושמירת מזהה המשתמש והדוא״ל בדפדפן, נדרשות להפעלת החשבון. UserWay עשוי לשמור העדפת נגישות. Google Fonts מקבל את כתובת ה־IP בעת טעינת הגופן. אין עוגיות פרסום ואין עוגיות אנליטיקה. באנר אישור וסירוב יתווסף לפני כל כלי מדידה או פרסום עתידי.
              </p>
            </section>

            <section className="mb-8">
              <h2 className={h2Class}>10. דיוור ישיר</h2>
              <p className={pClass}>
                תיבת דיוור נפרדת, ריקה כברירת מחדל, תתווסף בגרסה מעודכנת של האתר. עד אז המפעיל לא ישלח דיוור שיווקי. הסימון, כשיופיע, לא יהיה תנאי להרשמה או לתשלום. ביטול בכל עת אל{' '}
                <a href="mailto:gyapps1@gmail.com" className="text-indigo-300 hover:text-indigo-200 whitespace-nowrap">gyapps1@gmail.com</a>
                {' '}או אל{' '}
                <a href="tel:0505304642" className="text-indigo-300 hover:text-indigo-200 whitespace-nowrap">050-5304642</a>,
                והוא ייכנס לתוקף בתוך זמן סביר. הודעת שירות על אירוע שהמשתמש עצמו יזם אינה דיוור שיווקי.
              </p>
            </section>

            <section className="mb-8">
              <h2 className={h2Class}>11. קניין רוחני</h2>
              <p className={pClass}>הקוד, הממשק, השם Meet-M והטקסטים של המפעיל שייכים למפעיל. אין להעתיקם לשימוש מסחרי בלי אישור בכתב.</p>
              <p className={pClass}>
                המשתמש שומר בבעלותו את הטקסטים, הרשימות והתמונות שהוא מעלה, ונותן למפעיל רישיון להחזיקם ולהציגם רק כדי להפעיל את השירות. המשתמש מצהיר שיש לו זכות להעלות אותם. תבנית הזמנה של המפעיל ניתנת לשימוש בתוך Meet-M בלבד.
              </p>
            </section>

            <section className="mb-8">
              <h2 className={h2Class}>12. נגישות</h2>
              <p className={pClass}>
                המפעיל פועל להתאמה לתקן הישראלי 5568. פנייה על חסם נגישות נשלחת אל{' '}
                <a href="mailto:gyapps1@gmail.com" className="text-indigo-300 hover:text-indigo-200 whitespace-nowrap">gyapps1@gmail.com</a>
                {' '}או אל{' '}
                <a href="tel:0505304642" className="text-indigo-300 hover:text-indigo-200 whitespace-nowrap">050-5304642</a>.
                ווידג׳ט UserWay הוא כלי עזר.
              </p>
            </section>

            <section className="mb-8">
              <h2 className={h2Class}>13. עדכון, דין וסמכות</h2>
              <p className={pClass}>שינוי מהותי במסמך יפורסם באתר עם תאריך. המשך שימוש אחרי תאריך התחילה הוא הסכמה לנוסח החדש, והמשתמש רשאי לסגור את החשבון.</p>
              <p className={pClass}>הדין הישראלי חל. סמכות השיפוט: בתי המשפט במחוז תל אביב–יפו, בלי לגרוע מסמכות צרכנית שהדין קובע.</p>
            </section>

            <section className="mb-2 bg-indigo-500/10 border border-indigo-400/20 p-6 rounded-xl">
              <h2 className={h2Class}>14. יצירת קשר</h2>
              <p className={pClass}>גולן אפליקציות - מייטאם, עוסק 065567158.</p>
              <ul className="list-none space-y-2 text-base text-slate-300">
                <li>דוא״ל: <a href="mailto:gyapps1@gmail.com" className="text-indigo-300 hover:text-indigo-200 whitespace-nowrap">gyapps1@gmail.com</a></li>
                <li>טלפון: <a href="tel:0505304642" className="text-indigo-300 hover:text-indigo-200 whitespace-nowrap">050-5304642</a></li>
                <li>דואר: ת״ד 6043, קדימה צורן</li>
              </ul>
            </section>
          </article>
        </main>

        <Footer />
      </div>
    </>
  );
}
