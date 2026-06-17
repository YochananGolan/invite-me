export default function MobileStateMessage({ variant = 'loading', title, description }) {
  const isLoading = variant === 'loading';
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center rounded-[1.75rem] border border-white/10 bg-white/[0.04] px-6 py-12 text-center"
      data-testid={isLoading ? 'mobile-state-loading' : 'mobile-state-empty'}
    >
      <div className="text-4xl" aria-hidden="true">{isLoading ? '⏳' : '📊'}</div>
      <div className="mt-4 text-xl font-black text-white">
        {title || (isLoading ? 'טוען נתונים...' : 'אין נתונים להצגה')}
      </div>
      {description && (
        <p className="mt-3 max-w-xs text-sm font-semibold leading-6 text-slate-400">{description}</p>
      )}
      {isLoading && (
        <div className="mt-5 h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-indigo-400/70" />
        </div>
      )}
    </div>
  );
}
