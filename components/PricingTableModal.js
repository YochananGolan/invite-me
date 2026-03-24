const PLANS = [
  { id: 'א', range: 'עד 5 הודעות', price: 5, desc: 'מתאים לאירועים קטנים' },
  { id: 'ב', range: 'מ־51 עד 200 הודעות', price: 149, desc: 'מתאים לרוב האירועים' },
  { id: 'ג', range: 'מ־201 עד 350 הודעות', price: 199, desc: 'לאירועים גדולים' },
  { id: 'ד', range: 'מ־351 עד 500 הודעות', price: 259, desc: 'לאירועים גדולים מאוד' },
  { id: 'הרחבה', range: '100 הודעות נוספות', price: 100, desc: 'חבילת הרחבה' },
];

export default function PricingTableModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto" dir="rtl">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl px-6 pb-6 pt-12 sm:px-8 sm:pb-8 sm:pt-10 w-full max-w-2xl">
          <button
            onClick={handleClose}
            className="absolute top-4 left-4 text-2xl sm:text-3xl text-gray-500 hover:text-gray-700 leading-none"
            aria-label="סגור"
          >
            &times;
          </button>

          <h2 className="text-2xl font-bold text-center text-primary mb-6 pl-14 pr-10 sm:px-0">
            חבילות ומחירים
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-primary bg-primary/5">
                  <th className="text-right py-3 px-4 font-bold text-primary">מסלול</th>
                  <th className="text-right py-3 px-4 font-bold text-primary">מספר הודעות</th>
                  <th className="text-right py-3 px-4 font-bold text-primary">מחיר</th>
                </tr>
              </thead>
              <tbody>
                {PLANS.map((plan) => (
                  <tr
                    key={plan.id}
                    className={`border-b border-gray-200 hover:bg-gray-50 ${
                      plan.recommended ? 'bg-amber-50' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-primary">מסלול {plan.id}</span>
                        <span className="text-sm text-gray-500">{plan.desc}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-700">{plan.range}</td>
                    <td className="py-3 px-4 font-bold text-primary">{plan.price} ₪</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-center text-gray-500 text-sm mt-4">
            * המחירים הם חד פעמיים לכל אירוע
          </p>
          <p className="text-center text-blue-700 text-sm mt-2">
            💡 ניתן לרכוש חבילות הרחבה של 100 הודעות נוספות ב־100 ₪
          </p>

          <div className="mt-6 flex justify-center">
            <button
              onClick={onClose}
              className="bg-primary text-white px-8 py-3 rounded-full font-medium hover:bg-primary/90 transition-colors"
            >
              סגור
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
