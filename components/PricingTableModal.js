import Modal, { ModalHeader, ModalBody, ModalFooter } from './Modal';

const PLANS = [
  { id: 'א', range: '1 הודעה · 1 ש״ח', price: 1, desc: 'מתאים לאירועים קטנים' },
  { id: 'ב', range: 'מ־2 עד 200 הודעות · 1 ש״ח', price: 1, desc: 'מתאים לרוב האירועים' },
  { id: 'ג', range: 'מ־201 עד 350 הודעות · 1 ש״ח', price: 1, desc: 'לאירועים גדולים' },
  { id: 'ד', range: 'מ־351 עד 500 הודעות · 1 ש״ח', price: 1, desc: 'לאירועים גדולים מאוד' },
  { id: 'הרחבה', range: '100 הודעות נוספות · 1 ש״ח', price: 1, desc: 'חבילת הרחבה' },
];

export default function PricingTableModal({ isOpen, onClose }) {
  const handleClose = () => {
    onClose();
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <Modal size="lg" open={isOpen} onClose={handleClose}>
      <ModalHeader onClose={handleClose}>חבילות ומחירים</ModalHeader>

      <ModalBody>
        <div className="overflow-x-auto" dir="rtl">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-indigo-400/30 bg-indigo-500/10">
                <th className="text-right py-2 px-3 font-bold text-indigo-300">מסלול</th>
                <th className="text-right py-2 px-3 font-bold text-indigo-300">מספר הודעות</th>
                <th className="text-right py-2 px-3 font-bold text-indigo-300">מחיר</th>
              </tr>
            </thead>
            <tbody>
              {PLANS.map((plan) => (
                <tr
                  key={plan.id}
                  className={`border-b border-white/10 hover:bg-white/[0.04] transition-colors ${
                    plan.recommended ? 'border-indigo-500/50 bg-indigo-500/10' : ''
                  }`}
                >
                  <td className="py-2 px-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-indigo-300">מסלול {plan.id}</span>
                      <span className="text-sm text-slate-400">{plan.desc}</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-slate-300">{plan.range}</td>
                  <td className="py-2 px-3 font-bold text-indigo-300">{plan.price} ₪</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-center text-slate-400 text-sm mt-4">
          * המחירים הם חד פעמיים לכל אירוע
        </p>
        <p className="text-center text-indigo-300 text-sm mt-2">
          💡 ניתן לרכוש חבילות הרחבה של 100 הודעות נוספות ב־1 ₪
        </p>
      </ModalBody>

      <ModalFooter className="justify-center">
        <button
          onClick={onClose}
          className="bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_5px_22px_rgba(99,70,230,0.45)] text-white font-bold rounded-xl px-8 py-3 hover:opacity-90 transition-opacity"
        >
          סגור
        </button>
      </ModalFooter>
    </Modal>
  );
}
