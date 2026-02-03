import Head from 'next/head';
import Link from 'next/link';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';

export default function Terms() {
  return (
    <>
      <Head>
        <title>תנאי שימוש ומדיניות פרטיות | Meet-M</title>
        <meta name="description" content="תנאי השימוש ומדיניות הפרטיות של Meet-M" />
      </Head>

      <div className="min-h-screen flex flex-col">
        <NavBar />

        <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
          {/* Back Button */}
          <Link
            href="/"
            className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-6 font-medium"
          >
            ← חזרה לדף הבית
          </Link>

          <div className="bg-white rounded-lg shadow-lg p-8 prose prose-lg max-w-none" dir="rtl">
            <h1 className="text-4xl font-bold text-center mb-8 text-gray-900">תנאי שימוש</h1>

            <section className="mb-8">
              <p className="text-lg leading-relaxed">
                ברוכים הבאים ל<strong>Meet-M</strong> (להלן: "האתר") אשר מופעל על ידי <strong>גולן אפליקציות - מייטאם</strong> (להלן: "המפעיל"). תנאים אלו מסדירים את אופן השימוש באתר.
              </p>
              <p className="text-lg leading-relaxed">
                האתר מיועד לשימוש על-ידי בגירים מעל גיל 18 בלבד (להלן: "המשתמש" או "המשתמשים").
              </p>
              <p className="text-lg leading-relaxed">
                המשתמש מתחייב להשתמש באתר למטרות חוקיות בלבד, ובאופן שאינו מפר הוראות כל דין.
              </p>
              <p className="text-lg leading-relaxed">
                המפעיל שומר לעצמו את הזכות לשנות את האתר או למחוק תכנים לפי שיקול דעתו הבלעדי, ללא צורך במתן התראה מוקדמת.
              </p>
              <p className="text-lg leading-relaxed">
                לא תהיה למשתמש כל טענה בקשר לדיוק, שלמות או מהימנות התכנים הנמסרים במסגרת השימוש באתר.
              </p>
              <p className="text-lg leading-relaxed font-semibold">
                השימוש באתר כפוף להוראות המפורטות במסמך זה. בעצם השימוש באתר, המשתמש מביע את הסכמתו המלאה והבלתי חוזרת לתנאים המפורטים להלן.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-3xl font-bold mb-4 text-gray-900">מדיניות פרטיות</h2>

              <h3 className="text-2xl font-semibold mb-3 text-gray-800">הגדרות</h3>
              <p className="text-lg leading-relaxed">לעניין סעיף זה:</p>
              <ul className="list-disc list-inside space-y-2 text-lg">
                <li><strong>"מידע"</strong> – לרבות מידע אישי ו/או מידע רגיש (כהגדרתם להלן);</li>
                <li><strong>"מידע אישי"</strong> – כל מידע המזהה את המשתמש, לרבות (אך לא רק) שם מלא, כתובת, מספר טלפון, דוא"ל וכתובת IP;</li>
                <li><strong>"מידע רגיש"</strong> – מידע אישי אודות מצבו האישי ו/או הכלכלי ו/או התעסוקתי ו/או הבריאותי של המשתמש;</li>
                <li><strong>"עיבוד מידע"</strong> – כל פעולה המתבצעת במידע, לרבות שימוש ו/או איסוף ו/או שמירה ו/או שיתוף ו/או מחיקה;</li>
                <li><strong>"מעבד מידע"</strong> – המפעיל ו/או ספקי שירות חיצוניים אשר מעבדים את המידע.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-semibold mb-3 text-gray-800">איסוף מידע</h3>
              <p className="text-lg leading-relaxed">
                המפעיל עשוי לאסוף מידע אודות משתמשים, לרבות (אך לא רק) פרטים שמילא משתמש בטפסי האתר (לרבות שם, טלפון, דוא"ל, רמת אנגלית, ניסיון תעסוקתי, רקע צבאי, הכנסה חודשית וכל מידע רלוונטי נוסף אחר), פרטים שנמסרו למפעיל בעת מתן השירותים נשוא האתר, היסטוריית התקשרות עם המפעיל, כתובת IP, מערכת הפעלה, סוג דפדפן, משך שהייה באתר, פעולות שביצע משתמש בעת השימוש באתר ומזהי פרסום בהתאם לכלים המוטמעים.
              </p>
              <p className="text-lg leading-relaxed">
                כל מידע שייאסף על-ידי המפעיל ישמש לשם תפעול שוטף של האתר, שיפור חווית המשתמש באתר, אבטחת מידע, ניתוח נתונים ואופטימיזציה, ניטור אחר קמפיינים והתאמתם למשתמשים, שיפור איכות התכנים באתר, מענה לפניות משתמשים לשם מתן השירותים המוצעים במסגרת האתר וכן לשם עמידה בכל דין.
              </p>
              <p className="text-lg leading-relaxed font-semibold">
                המשתמש רשאי לעיין במידע, לתקנו, לעדכנו ואף לבקש מחיקתו המלאה בכל עת באמצעות פנייה לכתובת הדוא"ל <a href="mailto:gyapps1@gmail.com" className="text-purple-600 hover:text-purple-700">gyapps1@gmail.com</a>.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-semibold mb-3 text-gray-800">העברת מידע לצדדים שלישיים</h3>
              <p className="text-lg leading-relaxed">
                ידוע למשתמש כי ייתכן שהמידע יועבר לצדדים שלישיים, לרבות לספקי CRM, ספקי שירותי ענן וגיבוי, ספקי דיוור, ספקי אנליטיקה אשר מיישמים רמת אבטחה נאותה, וכן במקרים בהם המפעיל יידרש להעביר את המידע על-פי כל דין.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-semibold mb-3 text-gray-800">אבטחת מידע</h3>
              <p className="text-lg leading-relaxed">
                המפעיל מיישם נהלים, אמצעים טכנולוגיים ומערכות מתקדמות לשם אבטחת המידע והגנה על פרטיות המשתמשים באמצעות ספקי צד שלישי. בכלל זה נוקט המפעיל באמצעי זהירות מקובלים, לרבות שימוש בסיסמאות מאובטחות, הגבלת הרשאות גישה, הפעלת מערכות CRM מאובטחות, ביצוע גיבויים תקופתיים ויישום אמצעי ניטור ובקרה מתאימים.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-semibold mb-3 text-gray-800">שימוש בעוגיות (Cookies)</h3>
              <p className="text-lg leading-relaxed">
                האתר עושה שימוש בעוגיות (Cookies) ובטכנולוגיות מעקב נוספות לשם תפעולו התקין, התאמת השירותים למשתמש, שיפור חוויית המשתמש, ניתוח נתוני שימוש, וכן לצורכי פרסום ומדידה.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-semibold mb-3 text-gray-800">דיוור ישיר</h3>
              <p className="text-lg leading-relaxed">
                המשתמש מודע לכך כי בכפוף למסירת פרטיו בטפסים והסכמתו לקבלת דיוור ישיר, יהיה רשאי המפעיל לצרפו לרשימת תפוצה לצורך קבלת דיוור באמצעות דואר אלקטרוני ו/או מסרונים, בקשר עם פעילותו העסקית של המפעיל. המשתמש יהיה רשאי בכל עת לבטל את הסכמתו כאמור.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-semibold mb-3 text-gray-800">קניין רוחני</h3>
              <p className="text-lg leading-relaxed">
                האתר, על כל רכיביו, לרבות אך לא רק, עיצוב, מבנה, ממשק המשתמש, קוד מקור וקוד יעד, אלגוריתמים, תוכנות, יישומים, קבצי שמע, תכנים מילוליים, חזותיים ו/או קוליים, תמונות, סימנים מסחריים, שמות מסחריים, לוגו, סיסמאות, תיעוד, וכל יצירה אחרת הקשורה בפיתוח, תפעול או שיווק האתר הינם ויהיו בכל עת רכושו הבלעדי של המפעיל.
              </p>
              <p className="text-lg leading-relaxed">
                אין להעתיק, לשכפל, להפיץ, לפרסם מחדש או לעשות כל שימוש מסחרי בקניין הרוחני ללא הסכמה מראש ובכתב של המפעיל.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-3xl font-bold mb-4 text-gray-900">כללי</h2>
              <p className="text-lg leading-relaxed">
                המשתמש מצהיר בזאת כי קרא את כל ההוראות, הבין את תוכנם, והוא מסכים להם במלואם וללא כל הסתייגות.
              </p>
              <p className="text-lg leading-relaxed">
                המפעיל שומר לעצמו את הזכות לעדכן מסמך זה מעת לעת והכל על-פי שיקול דעתו הבלעדי.
              </p>
              <p className="text-lg leading-relaxed">
                סמכות השיפוט הבלעדית בכל עניין ו/או סכסוך הנובע מהאתר, השימוש בו, תנאי השימוש או מכל עניין הנוגע להם, נתונה לבתי המשפט המוסמכים במחוז תל-אביב יפו בלבד, והדין החל יהיה הדין הישראלי.
              </p>
            </section>

            <section className="mb-8 bg-purple-50 p-6 rounded-lg">
              <h3 className="text-2xl font-semibold mb-3 text-gray-800">יצירת קשר</h3>
              <p className="text-lg leading-relaxed">
                לכל שאלה, הבהרה או פנייה בנוגע למסמך זה, ניתן ליצור קשר עם המפעיל באמצעות:
              </p>
              <ul className="list-none space-y-2 text-lg mt-4">
                <li><strong>כתובת דוא"ל:</strong> <a href="mailto:gyapps1@gmail.com" className="text-purple-600 hover:text-purple-700">gyapps1@gmail.com</a></li>
              </ul>
            </section>

            <div className="text-center text-gray-500 text-sm mt-8 pt-8 border-t">
              <p>עדכון אחרון: {new Date().toLocaleDateString('he-IL')}</p>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
