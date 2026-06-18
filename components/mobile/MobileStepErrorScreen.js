import MobileFullScreenShell from './MobileFullScreenShell';

export default function MobileStepErrorScreen({ message, onClose }) {
  return (
    <MobileFullScreenShell
      testId="mobile-step-error-screen"
      eyebrow="שלבי יצירת הזמנה"
      title="לא ניתן להמשיך"
      onClose={onClose}
      closeLabel="חזור"
    >
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full border border-amber-300/35 bg-amber-500/15 text-4xl"
          aria-hidden="true"
        >
          ⚠
        </div>
        <p
          className="mt-6 max-w-sm text-center text-xl font-black leading-relaxed text-amber-100"
          data-testid="mobile-step-error-message"
        >
          {message}
        </p>
      </div>
    </MobileFullScreenShell>
  );
}
