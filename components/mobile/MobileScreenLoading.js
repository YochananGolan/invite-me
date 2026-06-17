export default function MobileScreenLoading({ message = 'טוען...' }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-300"
        aria-hidden="true"
      />
      <p className="mt-4 text-sm font-semibold text-slate-400">{message}</p>
    </div>
  );
}
