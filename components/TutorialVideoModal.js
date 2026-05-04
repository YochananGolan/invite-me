import { useEffect } from 'react';

const tutorialSteps = [
  'נרשמים או מתחברים לחשבון Meet-M.',
  'יוצרים אירוע חדש ובוחרים חבילה מתאימה.',
  'ממלאים את פרטי האירוע ובוחרים עיצוב להזמנה.',
  'מעלים רשימת אורחים מאקסל ושולחים SMS או WhatsApp.',
  'עוקבים אחרי אישורי הגעה ודוחות הבקרה בזמן אמת.',
];

export default function TutorialVideoModal({ isOpen, onClose, videoUrl = process.env.NEXT_PUBLIC_TUTORIAL_VIDEO_URL }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasVideo = Boolean(videoUrl);

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/75 px-4 py-6" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="tutorial-video-title">
      <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute left-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-3xl leading-none text-gray-600 shadow-md transition hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          aria-label="סגור סרטון הדרכה"
        >
          &times;
        </button>

        <div className="grid lg:grid-cols-[1.55fr_1fr]">
          <div className="bg-gradient-to-br from-primary via-purple-800 to-indigo-900 p-4 sm:p-6 lg:p-8">
            <div className="overflow-hidden rounded-2xl border border-white/20 bg-black shadow-2xl">
              {hasVideo ? (
                <video
                  className="aspect-video w-full bg-black"
                  controls
                  playsInline
                  preload="metadata"
                  poster="/images/background-stairs-flowers.png"
                >
                  <source src={videoUrl} />
                  הדפדפן שלך לא תומך בהצגת וידאו.
                </video>
              ) : (
                <div className="flex aspect-video flex-col items-center justify-center gap-5 bg-gradient-to-br from-gray-950 to-gray-800 p-8 text-center text-white">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15 text-4xl shadow-lg ring-4 ring-white/10">
                    ▶
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold">סרטון הדרכה Meet-M</div>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-white/75">
                      כאן יוצג סרטון ההדרכה המלא. ניתן להגדיר קישור בקובץ הסביבה באמצעות NEXT_PUBLIC_TUTORIAL_VIDEO_URL.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-8">
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.25em] text-primary">הדרכה מהירה</p>
            <h2 id="tutorial-video-title" className="mb-4 text-3xl font-extrabold leading-tight text-gray-900">
              איך יוצרים הזמנה ומנהלים אירוע ב־Meet-M?
            </h2>
            <p className="mb-6 text-base leading-relaxed text-gray-600">
              הסרטון מציג את התהליך מקצה לקצה: יצירת אירוע, עיצוב הזמנה, העלאת אורחים, שליחה ומעקב אחרי אישורי הגעה.
            </p>

            <ol className="space-y-3">
              {tutorialSteps.map((step, index) => (
                <li key={step} className="flex gap-3 rounded-2xl bg-gray-50 p-3 text-sm font-semibold text-gray-700">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <button
              type="button"
              onClick={onClose}
              className="mt-7 w-full rounded-full border-2 border-primary px-6 py-3 font-bold text-primary transition hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            >
              סגור וחזור לדף הבית
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
